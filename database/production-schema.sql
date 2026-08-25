
-- AlchemyRotas - Complete Production Database Schema
-- Based on commit: Add comprehensive logging to backend
-- Execute this file to create all necessary tables and relationships

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_category VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    hire_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    current_route VARCHAR(255),
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points JSONB,
    total_distance DECIMAL(10, 2),
    estimated_time VARCHAR(50),
    optimized_order JSONB,
    polyline TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trucks table
CREATE TABLE IF NOT EXISTS trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(255),
    year INTEGER CHECK (year > 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'inactive')),
    current_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    current_route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    active_route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    route_started_at TIMESTAMP,
    last_maintenance DATE,
    mileage INTEGER DEFAULT 0 CHECK (mileage >= 0),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
    route_name VARCHAR(255),
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- RELATIONSHIP TABLES
-- ============================================================================

-- Truck routes relationship table
CREATE TABLE IF NOT EXISTS truck_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_point_id VARCHAR(50),
    UNIQUE(truck_id, route_id, status)
);

-- Route progress tracking
CREATE TABLE IF NOT EXISTS route_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_route_id UUID NOT NULL REFERENCES truck_routes(id) ON DELETE CASCADE,
    point_id VARCHAR(50) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- HISTORY AND TRACKING TABLES
-- ============================================================================

-- Truck location history
CREATE TABLE IF NOT EXISTS truck_location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5, 2) CHECK (speed >= 0),
    heading DECIMAL(5, 2) CHECK (heading >= 0 AND heading < 360)
);

-- Trips table for tracking completed routes
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    distance_km DECIMAL(10, 2) CHECK (distance_km >= 0),
    duration_minutes INTEGER CHECK (duration_minutes >= 0),
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MAINTENANCE AND FILES TABLES
-- ============================================================================

-- Maintenance table
CREATE TABLE IF NOT EXISTS maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
    maintenance_type VARCHAR(100),
    description TEXT,
    cost DECIMAL(10, 2) CHECK (cost >= 0),
    scheduled_date DATE,
    completed_date DATE,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice files table
CREATE TABLE IF NOT EXISTS invoice_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER CHECK (file_size > 0),
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SYSTEM TABLES
-- ============================================================================

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    parameters JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'error'))
);

-- ============================================================================
-- FUNCTIONS FOR DEPENDENCY CHECKING
-- ============================================================================

-- Function to check deletion dependencies
CREATE OR REPLACE FUNCTION check_deletion_dependencies(
    table_name TEXT,
    record_id UUID
) RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    truck_count INTEGER;
    trip_count INTEGER;
    schedule_count INTEGER;
    maintenance_count INTEGER;
BEGIN
    CASE table_name
        WHEN 'drivers' THEN
            -- Check trucks assigned to driver
            SELECT COUNT(*) INTO truck_count 
            FROM trucks WHERE current_driver_id = record_id;
            
            -- Check trips by driver
            SELECT COUNT(*) INTO trip_count 
            FROM trips WHERE driver_id = record_id;
            
            result := jsonb_build_object(
                'can_delete', truck_count = 0,
                'trucks_count', truck_count,
                'trips_count', trip_count,
                'message', CASE 
                    WHEN truck_count > 0 THEN 'Driver has assigned trucks'
                    ELSE 'Driver can be safely deleted'
                END
            );
            
        WHEN 'trucks' THEN
            -- Check active schedules
            SELECT COUNT(*) INTO schedule_count 
            FROM schedules WHERE truck_id = record_id AND status IN ('scheduled', 'in_progress');
            
            -- Check maintenance records
            SELECT COUNT(*) INTO maintenance_count 
            FROM maintenance WHERE truck_id = record_id AND status IN ('scheduled', 'in_progress');
            
            -- Check trips
            SELECT COUNT(*) INTO trip_count 
            FROM trips WHERE truck_id = record_id;
            
            result := jsonb_build_object(
                'can_delete', schedule_count = 0 AND maintenance_count = 0,
                'active_schedules', schedule_count,
                'active_maintenance', maintenance_count,
                'total_trips', trip_count,
                'message', CASE 
                    WHEN schedule_count > 0 OR maintenance_count > 0 THEN 'Truck has active schedules or maintenance'
                    ELSE 'Truck can be safely deleted'
                END
            );
            
        WHEN 'routes' THEN
            -- Check active truck routes
            SELECT COUNT(*) INTO truck_count 
            FROM truck_routes WHERE route_id = record_id AND status = 'active';
            
            result := jsonb_build_object(
                'can_delete', truck_count = 0,
                'active_assignments', truck_count,
                'message', CASE 
                    WHEN truck_count > 0 THEN 'Route has active truck assignments'
                    ELSE 'Route can be safely deleted'
                END
            );
    END CASE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update driver trip count
CREATE OR REPLACE FUNCTION update_driver_trip_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
        UPDATE drivers 
        SET total_trips = total_trips + 1 
        WHERE id = NEW.driver_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
        UPDATE drivers 
        SET total_trips = total_trips + 1 
        WHERE id = NEW.driver_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status != 'completed' THEN
        UPDATE drivers 
        SET total_trips = GREATEST(total_trips - 1, 0) 
        WHERE id = OLD.driver_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trip count updates
CREATE TRIGGER update_driver_trip_count_trigger
    AFTER INSERT OR UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_driver_trip_count();

-- ============================================================================
-- OPTIMIZED INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_license ON drivers(license_number);
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks(status);
CREATE INDEX IF NOT EXISTS idx_trucks_plate ON trucks(plate);
CREATE INDEX IF NOT EXISTS idx_trucks_driver ON trucks(current_driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);

-- Schedule and date-based indexes
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedules_truck ON schedules(truck_id);
CREATE INDEX IF NOT EXISTS idx_schedules_driver ON schedules(driver_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_truck_routes_truck_id ON truck_routes(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_routes_route_id ON truck_routes(route_id);
CREATE INDEX IF NOT EXISTS idx_truck_routes_status ON truck_routes(status);

-- Location and tracking indexes
CREATE INDEX IF NOT EXISTS idx_truck_location_truck_id ON truck_location_history(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_location_recorded_at ON truck_location_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_route_progress_truck_route_id ON route_progress(truck_route_id);

-- Trip and maintenance indexes
CREATE INDEX IF NOT EXISTS idx_trips_truck_id ON trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(created_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_truck_id ON maintenance(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance(scheduled_date);

-- System indexes
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_schedules_truck_date ON schedules(truck_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_trips_truck_status ON trips(truck_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_truck_status ON maintenance(truck_id, status);

-- ============================================================================
-- INITIAL SYSTEM SETTINGS
-- ============================================================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, description) 
VALUES 
    ('theme', 'light', 'string', 'Application theme'),
    ('company_name', 'AlchemyRotas', 'string', 'Company name'),
    ('default_map_zoom', '12', 'number', 'Default map zoom level'),
    ('max_file_size_mb', '10', 'number', 'Maximum file upload size in MB'),
    ('backup_retention_days', '30', 'number', 'Number of days to retain backups'),
    ('maintenance_alert_days', '7', 'number', 'Days before maintenance to alert'),
    ('driver_license_expiry_alert_days', '30', 'number', 'Days before license expiry to alert')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'AlchemyRotas Database Schema Created Successfully!';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Features implemented:';
    RAISE NOTICE '- Complete table structure with proper constraints';
    RAISE NOTICE '- Smart foreign key relationships (CASCADE/SET NULL/RESTRICT)';
    RAISE NOTICE '- Dependency checking function';
    RAISE NOTICE '- Automatic timestamp updates';
    RAISE NOTICE '- Driver trip count tracking';
    RAISE NOTICE '- Optimized indexes for performance';
    RAISE NOTICE '- System settings initialized';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Database is ready for production use!';
END $$;
