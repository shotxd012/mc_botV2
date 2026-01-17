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

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const admin = dataManager.getAdmin(username);

    if (admin && bcrypt.compareSync(password, admin.password)) {
        req.session.user = { username: admin.username };
        res.redirect('/');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
