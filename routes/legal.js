const express = require('express');
const router = express.Router();

const pages = {
    privacy: {
        title: 'Privacy Policy',
        view: 'legal/privacy'
    },
    terms: {
        title: 'Terms of Service',
        view: 'legal/terms'
    },
    'data-rights': {
        title: 'Data Rights & Deletion',
        view: 'legal/data-rights'
    },
    cookies: {
        title: 'Cookies & Acceptable Use',
        view: 'legal/cookies'
    }
};

function renderPage(req, res, key) {
    const page = pages[key];
    res.render(page.view, { title: page.title, legalPage: key });
}

router.get('/privacy', (req, res) => renderPage(req, res, 'privacy'));
router.get('/terms', (req, res) => renderPage(req, res, 'terms'));
router.get('/data-rights', (req, res) => renderPage(req, res, 'data-rights'));
router.get('/cookies', (req, res) => renderPage(req, res, 'cookies'));

module.exports = router;
