const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Debug: Log environment variables (without showing passwords)
console.log('=== Environment Variables Check ===');
console.log('DB_HOST:', process.env.DB_HOST ? 'SET' : 'NOT SET');
console.log('DB_PORT:', process.env.DB_PORT ? 'SET' : 'NOT SET');
console.log('DB_USER:', process.env.DB_USER ? 'SET' : 'NOT SET');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET (hidden)' : 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME ? 'SET' : 'NOT SET');
console.log('DB_SSL:', process.env.DB_SSL);
console.log('PORT:', PORT);
console.log('===================================');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Database connection pool with SSL for Aiven
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : undefined
});

// Test database connection
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        console.error('Connection attempted to:', {
            host: process.env.DB_HOST || 'NOT SET',
            port: process.env.DB_PORT || 'NOT SET',
            database: process.env.DB_NAME || 'NOT SET',
            user: process.env.DB_USER || 'NOT SET'
        });
    });

// Helper function to convert rows to CSV
function convertToCSV(rows) {
    if (rows.length === 0) return '';
    
    // Get headers
    const headers = Object.keys(rows[0]);
    
    // Create CSV header row
    const csvHeaders = headers.join(',');
    
    // Create CSV data rows
    const csvRows = rows.map(row => {
        return headers.map(header => {
            let value = row[header];
            
            // Handle null/undefined
            if (value === null || value === undefined) {
                return '';
            }
            
            // Handle dates
            if (value instanceof Date) {
                value = value.toISOString();
            }
            
            // Convert to string and escape quotes
            value = String(value).replace(/"/g, '""');
            
            // Wrap in quotes if contains comma, newline, or quote
            if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                value = `"${value}"`;
            }
            
            return value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

// API Routes

// Get all submissions
app.get('/api/submissions', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM warehouse_submissions ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// Export all submissions as CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, division, submission_month, submission_year, warehouse_hours, created_at, updated_at FROM warehouse_submissions ORDER BY created_at DESC'
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No data to export' });
        }
        
        const csv = convertToCSV(rows);
        
        // Set headers to trigger download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=warehouse_hours_export_${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Export all submissions as JSON
app.get('/api/export/json', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM warehouse_submissions ORDER BY created_at DESC'
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No data to export' });
        }
        
        // Set headers to trigger download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=warehouse_hours_export_${Date.now()}.json`);
        res.json(rows);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Get submission by division, month, and year
app.get('/api/submissions/:division/:month/:year', async (req, res) => {
    try {
        const { division, month, year } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM warehouse_submissions WHERE division = ? AND submission_month = ? AND submission_year = ?',
            [division, month, year]
        );
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Submission not found' });
        }
    } catch (error) {
        console.error('Error fetching submission:', error);
        res.status(500).json({ error: 'Failed to fetch submission' });
    }
});

// Check if division has already submitted for a specific month/year
app.get('/api/check-submission/:division/:month/:year', async (req, res) => {
    try {
        const { division, month, year } = req.params;
        const [rows] = await pool.query(
            'SELECT id FROM warehouse_submissions WHERE division = ? AND submission_month = ? AND submission_year = ?',
            [division, month, year]
        );
        
        res.json({ 
            exists: rows.length > 0,
            submissionId: rows.length > 0 ? rows[0].id : null
        });
    } catch (error) {
        console.error('Error checking submission:', error);
        res.status(500).json({ error: 'Failed to check submission' });
    }
});

// Create new submission
app.post('/api/submissions', async (req, res) => {
    try {
        const { division, submission_month, submission_year, warehouse_hours } = req.body;
        
        if (!division || !submission_month || !submission_year || warehouse_hours === undefined) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const [existing] = await pool.query(
            'SELECT id FROM warehouse_submissions WHERE division = ? AND submission_month = ? AND submission_year = ?',
            [division, submission_month, submission_year]
        );

        if (existing.length > 0) {
            return res.status(409).json({ 
                error: 'Submission already exists for this division, month, and year',
                submissionId: existing[0].id
            });
        }

        const [result] = await pool.query(
            'INSERT INTO warehouse_submissions (division, submission_month, submission_year, warehouse_hours) VALUES (?, ?, ?, ?)',
            [division, submission_month, submission_year, warehouse_hours]
        );

        res.status(201).json({
            message: 'Submission created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating submission:', error);
        res.status(500).json({ error: 'Failed to create submission' });
    }
});

// Update existing submission
app.put('/api/submissions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { warehouse_hours } = req.body;

        if (warehouse_hours === undefined) {
            return res.status(400).json({ error: 'Warehouse hours is required' });
        }

        const [result] = await pool.query(
            'UPDATE warehouse_submissions SET warehouse_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [warehouse_hours, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        res.json({ message: 'Submission updated successfully' });
    } catch (error) {
        console.error('Error updating submission:', error);
        res.status(500).json({ error: 'Failed to update submission' });
    }
});

// Delete submission
app.delete('/api/submissions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'DELETE FROM warehouse_submissions WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        res.json({ message: 'Submission deleted successfully' });
    } catch (error) {
        console.error('Error deleting submission:', error);
        res.status(500).json({ error: 'Failed to delete submission' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
