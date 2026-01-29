/**
 * Error.tsx
 * Handles display when users navigate to a route that doesn't exist.
 * @version 2024.04.06
 */
import React from 'react';
import { Typography, Box } from '@mui/material';
import { Link } from 'react-router-dom';

const Error = () => {

    return (
        <div>
            <Box sx={{ marginTop: '1rem' }}>
                <Typography variant="h2" sx={{ mb: 1, marginTop: 4 }} textAlign="center" color="black">
                    Oops!
                </Typography>
            </Box>
            <Box sx={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                <Box textAlign="center" >
                    <Typography variant="h4" sx={{ mb: 1, marginTop: 4 }} textAlign="left" color="black">
                        We couldn't find the page you were looking for. This is either because:
                        <Typography component="ul" sx={{ paddingLeft: '2rem', marginTop: '1rem' }}>
                            <Typography component="li">
                                · There is an error in the URL entered into your web browser.
                                Please check the URL and try again.
                            </Typography>
                            <Typography component="li">
                                · The page you are looking for has been moved or deleted.
                            </Typography>
                        </Typography>
                    </Typography>
                    <Typography variant="h4" sx={{ mb: 1, marginTop: 4 }} textAlign="left" color="black">
                        You can return to the homepage by clicking{' '}
                        <Link to="/" style={{ color: 'black', textDecoration: 'underline' }}>here</Link>.
                    </Typography>
                </Box>
            </Box>
        </div>
    );
};

export default Error;
