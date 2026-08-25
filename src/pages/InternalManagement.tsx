import React from 'react';
import { Navigate } from 'react-router-dom';

const InternalManagement: React.FC = () => {
  return <Navigate to="/sanitarios" replace />;
};

export default InternalManagement;