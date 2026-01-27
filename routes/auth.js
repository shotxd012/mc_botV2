const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const dataManager = require('../utils/dataManager');

router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await dataManager.getAdmin(username);

    if (admin && bcrypt.compareSync(password, admin.password)) {
        req.session.user = { username: admin.username };
        res.redirect('/');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
    const { username, password, confirmPassword } = req.body;
    
    // Validation
    if (!username || !password || !confirmPassword) {
        return res.render('register', { error: 'All fields are required' });
    }
    
    if (password !== confirmPassword) {
        return res.render('register', { error: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
        return res.render('register', { error: 'Password must be at least 6 characters long' });
    }
    
    try {
        // Check if user already exists
        const existingUser = await dataManager.getAdmin(username);
        if (existingUser) {
            return res.render('register', { error: 'Username already exists' });
        }
        
        // Create new user
        const result = await dataManager.createAdmin(username, password);
        if (result) {
            req.session.user = { username };
            res.redirect('/');
        } else {
            res.render('register', { error: 'Registration failed. Please try again.' });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { error: 'Registration failed. Please try again.' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
