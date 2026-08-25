
-- Drop existing tables if they exist (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS route_points CASCADE;
DROP TABLE IF EXISTS route_assignments CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS schedule_assignments CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS trucks CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table for authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ... keep existing code (all other table definitions from drivers to maintenance_records)

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    license_number VARCHAR(20) UNIQUE NOT NULL,
    license_category VARCHAR(10) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    hire_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trucks table
CREATE TABLE trucks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    plate VARCHAR(10) UNIQUE NOT NULL,
    model VARCHAR(100),
    year INTEGER,
    capacity_kg DECIMAL(10,2),
    fuel_type VARCHAR(20),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in-route', 'maintenance', 'inactive')),
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    current_driver_id UUID REFERENCES drivers(id),
    current_route UUID,
    last_maintenance DATE,
    next_maintenance DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routes table
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    estimated_duration INTEGER, -- in minutes
    estimated_distance DECIMAL(10,2), -- in km
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route points table
CREATE TABLE route_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    point_order INTEGER NOT NULL,
    type VARCHAR(20) DEFAULT 'waypoint' CHECK (type IN ('origin', 'destination', 'waypoint')),
    estimated_arrival_time TIME,
    notes TEXT,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    route_id UUID NOT NULL REFERENCES routes(id),
    start_date DATE NOT NULL,
    end_date DATE,
    days_of_week VARCHAR(20) DEFAULT '1,2,3,4,5', -- Monday to Friday by default
    start_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedule assignments table
CREATE TABLE schedule_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    truck_id UUID NOT NULL REFERENCES trucks(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    assigned_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route assignments table (for manual assignments)
CREATE TABLE route_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id),
    truck_id UUID NOT NULL REFERENCES trucks(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in-progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance records table
CREATE TABLE maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL REFERENCES trucks(id),
    type VARCHAR(50) NOT NULL,
    description TEXT,
    cost DECIMAL(10,2) DEFAULT 0.00,
    maintenance_date DATE NOT NULL,
    next_maintenance_date DATE,
    performed_by VARCHAR(100),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ... keep existing code (all indexes and triggers)
CREATE INDEX idx_trucks_plate ON trucks(plate);
CREATE INDEX idx_trucks_status ON trucks(status);
CREATE INDEX idx_trucks_current_driver ON trucks(current_driver_id);
CREATE INDEX idx_drivers_license ON drivers(license_number);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_route_points_route_id ON route_points(route_id);
CREATE INDEX idx_route_points_order ON route_points(point_order);
CREATE INDEX idx_schedules_route_id ON schedules(route_id);
CREATE INDEX idx_schedule_assignments_schedule_id ON schedule_assignments(schedule_id);
CREATE INDEX idx_schedule_assignments_truck_id ON schedule_assignments(truck_id);
CREATE INDEX idx_schedule_assignments_driver_id ON schedule_assignments(driver_id);
CREATE INDEX idx_route_assignments_route_id ON route_assignments(route_id);
CREATE INDEX idx_route_assignments_truck_id ON route_assignments(truck_id);
CREATE INDEX idx_route_assignments_driver_id ON route_assignments(driver_id);
CREATE INDEX idx_maintenance_records_truck_id ON maintenance_records(truck_id);
CREATE INDEX idx_maintenance_records_date ON maintenance_records(maintenance_date);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(active);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_records_updated_at BEFORE UPDATE ON maintenance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data

-- Insert admin user (username: phillipe.sodre, password: @Wallace44)
-- Senha em texto simples para teste
INSERT INTO users (username, password, name, email, role) VALUES 
('phillipe.sodre', '@Wallace44', 'Phillipe Sodré', 'phillipe.sodre@alchemyrotas.com', 'admin');

-- ... keep existing code (all sample data inserts from drivers to route assignments)

-- Insert sample drivers
INSERT INTO drivers (name, license_number, license_category, phone, email, hire_date, status) VALUES 
('João Silva', 'CNH001234567', 'D', '(11) 98765-4321', 'joao.silva@email.com', '2023-01-15', 'active'),
('Maria Santos', 'CNH007654321', 'D', '(11) 99887-6543', 'maria.santos@email.com', '2023-02-20', 'active'),
('Pedro Costa', 'CNH009876543', 'D', '(11) 97654-3210', 'pedro.costa@email.com', '2023-03-10', 'active'),
('Ana Oliveira', 'CNH005432109', 'D', '(11) 96543-2109', 'ana.oliveira@email.com', '2023-04-05', 'active'),
('Carlos Ferreira', 'CNH003210987', 'D', '(11) 95432-1098', 'carlos.ferreira@email.com', '2023-05-12', 'active');

-- Insert sample trucks
INSERT INTO trucks (name, plate, model, year, capacity_kg, fuel_type, status, location_lat, location_lng, last_maintenance, next_maintenance) VALUES 
('Caminhão Alpha', 'ABC-1234', 'Mercedes-Benz Atego', 2020, 8000.00, 'Diesel', 'available', -19.9167, -44.0833, '2024-01-15', '2024-07-15'),
('Caminhão Beta', 'DEF-5678', 'Volvo VM', 2019, 12000.00, 'Diesel', 'available', -19.9200, -44.0850, '2024-02-20', '2024-08-20'),
('Caminhão Gamma', 'GHI-9012', 'Scania P-Series', 2021, 15000.00, 'Diesel', 'available', -19.9150, -44.0800, '2024-03-10', '2024-09-10'),
('Caminhão Delta', 'JKL-3456', 'Iveco Daily', 2018, 5000.00, 'Diesel', 'maintenance', -19.9180, -44.0820, '2024-01-25', '2024-07-25'),
('Caminhão Echo', 'MNO-7890', 'Ford Cargo', 2022, 10000.00, 'Diesel', 'available', -19.9220, -44.0870, '2024-04-05', '2024-10-05');

-- Insert sample routes
INSERT INTO routes (name, description, status, estimated_duration, estimated_distance) VALUES 
('Rota Centro-Sul', 'Rota que conecta o centro da cidade à zona sul', 'active', 120, 25.5),
('Rota Norte-Leste', 'Percurso pela zona norte e leste da cidade', 'active', 90, 18.2),
('Rota Industrial', 'Atendimento ao distrito industrial', 'active', 150, 35.8),
('Rota Metropolitana', 'Cobertura da região metropolitana', 'active', 180, 45.2),
('Rota Expressa', 'Rota rápida centro-aeroporto', 'active', 60, 12.5);

-- Insert sample route points
INSERT INTO route_points (route_id, address, lat, lng, point_order, type, estimated_arrival_time) 
SELECT r.id, 'Terminal Central, Contagem-MG', -19.9167, -44.0833, 1, 'origin', '08:00:00'
FROM routes r WHERE r.name = 'Rota Centro-Sul';

INSERT INTO route_points (route_id, address, lat, lng, point_order, type, estimated_arrival_time) 
SELECT r.id, 'Shopping Contagem, Contagem-MG', -19.9200, -44.0850, 2, 'waypoint', '08:30:00'
FROM routes r WHERE r.name = 'Rota Centro-Sul';

INSERT INTO route_points (route_id, address, lat, lng, point_order, type, estimated_arrival_time) 
SELECT r.id, 'Bairro Eldorado, Contagem-MG', -19.9250, -44.0900, 3, 'destination', '09:00:00'
FROM routes r WHERE r.name = 'Rota Centro-Sul';

-- Insert sample maintenance records
INSERT INTO maintenance_records (truck_id, type, description, cost, maintenance_date, next_maintenance_date, performed_by, status)
SELECT t.id, 'Revisão Preventiva', 'Troca de óleo e filtros', 350.00, '2024-01-15', '2024-07-15', 'Oficina Central', 'completed'
FROM trucks t WHERE t.plate = 'ABC-1234';

INSERT INTO maintenance_records (truck_id, type, description, cost, maintenance_date, next_maintenance_date, performed_by, status)
SELECT t.id, 'Reparo de Freios', 'Substituição de pastilhas de freio', 280.00, '2024-02-20', '2024-08-20', 'Oficina Norte', 'completed'
FROM trucks t WHERE t.plate = 'DEF-5678';

INSERT INTO maintenance_records (truck_id, type, description, cost, maintenance_date, next_maintenance_date, performed_by, status)
SELECT t.id, 'Manutenção do Motor', 'Ajuste e limpeza do motor', 450.00, '2024-03-10', '2024-09-10', 'Oficina Especializada', 'completed'
FROM trucks t WHERE t.plate = 'GHI-9012';

-- Insert sample schedules
INSERT INTO schedules (name, route_id, start_date, end_date, days_of_week, start_time, status)
SELECT 'Cronograma Semanal Centro-Sul', r.id, '2024-06-01', '2024-12-31', '1,2,3,4,5', '08:00:00', 'active'
FROM routes r WHERE r.name = 'Rota Centro-Sul';

INSERT INTO schedules (name, route_id, start_date, end_date, days_of_week, start_time, status)
SELECT 'Cronograma Norte-Leste', r.id, '2024-06-01', '2024-12-31', '1,3,5', '07:30:00', 'active'
FROM routes r WHERE r.name = 'Rota Norte-Leste';

-- Update trucks with current drivers
UPDATE trucks SET current_driver_id = (SELECT id FROM drivers WHERE name = 'João Silva') WHERE plate = 'ABC-1234';
UPDATE trucks SET current_driver_id = (SELECT id FROM drivers WHERE name = 'Maria Santos') WHERE plate = 'DEF-5678';
UPDATE trucks SET current_driver_id = (SELECT id FROM drivers WHERE name = 'Pedro Costa') WHERE plate = 'GHI-9012';
UPDATE trucks SET current_driver_id = (SELECT id FROM drivers WHERE name = 'Ana Oliveira') WHERE plate = 'MNO-7890';

-- Assign current routes to some trucks
UPDATE trucks SET current_route = (SELECT id FROM routes WHERE name = 'Rota Centro-Sul'), status = 'in-route' WHERE plate = 'ABC-1234';
UPDATE trucks SET current_route = (SELECT id FROM routes WHERE name = 'Rota Norte-Leste'), status = 'in-route' WHERE plate = 'DEF-5678';
