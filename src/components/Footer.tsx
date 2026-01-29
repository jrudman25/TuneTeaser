/**
 * Footer.tsx
 * A small footer at the bottom of the page.
 * @version 2024.04.06
 */
import React from 'react';
import { Box, Typography } from '@mui/material';

const Footer = () => {

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            <Typography
                color = 'black'
                marginBottom = '0.5rem'
            >
                Made with ♥ by me © {new Date().getFullYear()}
            </Typography>
        </Box>
    );
};

export default Footer;
