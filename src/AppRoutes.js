import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';

import App from './App'
import Dropdown_test from './Dropdown'
import Modal_App from './Modall'

const AppRoutes = ()=>{

    return (
        <Router>
            <Routes>
                <Route path="/" element={<App/> }/>
            </Routes>
        </Router>
    )

}

export default AppRoutes;
