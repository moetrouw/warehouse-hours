import React, { useState, useEffect } from 'react';
import './App.css';

const DIVISIONS = [
  '100', '106', '10T', '12Z', '130', '140', '150', '155', '160', '170',
  '180', '195', '19P', '210', '21R', '220', '250', '272', '27C', '27G',
  '27T', '2A0', '300', '310', '320', '330', '335', '350', '360', '370',
  '40M', '41A', '42A', '43A', '43V', '44A', '45M', '500', '50A', '510',
  '52A', '530', '540', '550', '5A0', '5B0', '5C0', '5D0', '600', '610',
  '61P', '620', '62F', '650', '660', '670', '690', '70P', '70V', '71M',
  '720', '730', '740', '75A', '760'
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const YEARS = [2025, 2026];

function App() {
  const [formData, setFormData] = useState({
    division: '',
    submission_month: '',
    submission_year: '',
    warehouse_hours: ''
  });

  const [existingSubmission, setExistingSubmission] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submittedDivisions, setSubmittedDivisions] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Load all submissions for the log
  const loadAllSubmissions = async () => {
    try {
      const response = await fetch(`${API_URL}/submissions`);
      const data = await response.json();
      setAllSubmissions(data);
    } catch (error) {
      console.error('Error loading submissions:', error);
    }
  };

  // Check if submission exists when division, month, and year are selected
  useEffect(() => {
    const checkExistingSubmission = async () => {
      if (formData.division && formData.submission_month && formData.submission_year) {
        try {
          const response = await fetch(
            `${API_URL}/check-submission/${formData.division}/${formData.submission_month}/${formData.submission_year}`
          );
          const data = await response.json();

          if (data.exists) {
            const detailsResponse = await fetch(
              `${API_URL}/submissions/${formData.division}/${formData.submission_month}/${formData.submission_year}`
            );
            const submissionData = await detailsResponse.json();
            
            setExistingSubmission(submissionData);
            setIsEditMode(true);
            setFormData(prev => ({
              ...prev,
              warehouse_hours: submissionData.warehouse_hours.toString()
            }));
            setMessage({
              type: 'info',
              text: `Existing submission found. You can edit the warehouse hours below.`
            });
          } else {
            setExistingSubmission(null);
            setIsEditMode(false);
            setFormData(prev => ({ ...prev, warehouse_hours: '' }));
            setMessage({ type: '', text: '' });
          }
        } catch (error) {
          console.error('Error checking submission:', error);
        }
      }
    };

    checkExistingSubmission();
  }, [formData.division, formData.submission_month, formData.submission_year, API_URL]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    if (!formData.division || !formData.submission_month || !formData.submission_year || !formData.warehouse_hours) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      setLoading(false);
      return;
    }

    if (parseFloat(formData.warehouse_hours) <= 0) {
      setMessage({ type: 'error', text: 'Warehouse hours must be greater than 0' });
      setLoading(false);
      return;
    }

    try {
      let response;
      
      if (isEditMode && existingSubmission) {
        response = await fetch(`${API_URL}/submissions/${existingSubmission.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            warehouse_hours: parseFloat(formData.warehouse_hours)
          })
        });
      } else {
        response = await fetch(`${API_URL}/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            division: formData.division,
            submission_month: parseInt(formData.submission_month),
            submission_year: parseInt(formData.submission_year),
            warehouse_hours: parseFloat(formData.warehouse_hours)
          })
        });
      }

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: isEditMode 
            ? `Successfully updated submission for Division ${formData.division}!`
            : `Successfully submitted data for Division ${formData.division}!`
        });
        
        if (!isEditMode) {
          setSubmittedDivisions(prev => new Set([...prev, formData.division]));
        }

        // Reload submissions log if it's open
        if (showLog) {
          loadAllSubmissions();
        }

        setTimeout(() => {
          setFormData({
            division: '',
            submission_month: '',
            submission_year: '',
            warehouse_hours: ''
          });
          setExistingSubmission(null);
          setIsEditMode(false);
          setMessage({ type: '', text: '' });
        }, 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit data' });
      }
    } catch (error) {
      console.error('Error submitting data:', error);
      setMessage({ type: 'error', text: 'An error occurred while submitting data' });
    } finally {
      setLoading(false);
    }
  };

  const isDivisionDisabled = (division) => {
    return submittedDivisions.has(division) && formData.division !== division;
  };

  const handleEditFromLog = (submission) => {
    setFormData({
      division: submission.division,
      submission_month: submission.submission_month.toString(),
      submission_year: submission.submission_year.toString(),
      warehouse_hours: submission.warehouse_hours.toString()
    });
    setShowLog(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleLog = () => {
    if (!showLog) {
      loadAllSubmissions();
    }
    setShowLog(!showLog);
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>Warehouse Hours Submission</h1>
          <p className="subtitle">Pet Food Manufacturing - KPI Tracking</p>
          <button onClick={toggleLog} className="log-toggle-button">
            {showLog ? 'Hide Submission Log' : 'View Submission Log'}
          </button>
        </header>

        {showLog && (
          <div className="submission-log">
            <h2>All Submissions</h2>
            {allSubmissions.length === 0 ? (
              <p className="no-submissions">No submissions yet</p>
            ) : (
              <div className="log-table-container">
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Division</th>
                      <th>Month</th>
                      <th>Year</th>
                      <th>Hours</th>
                      <th>Submitted</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSubmissions.map((submission) => (
                      <tr key={submission.id}>
                        <td>{submission.division}</td>
                        <td>{MONTHS.find(m => m.value === submission.submission_month)?.label || submission.submission_month}</td>
                        <td>{submission.submission_year}</td>
                        <td>{submission.warehouse_hours}</td>
                        <td>{new Date(submission.created_at).toLocaleDateString()}</td>
                        <td>
                          <button 
                            onClick={() => handleEditFromLog(submission)}
                            className="edit-button"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="division">Division *</label>
            <select
              id="division"
              name="division"
              value={formData.division}
              onChange={handleInputChange}
              required
              className="form-control"
            >
              <option value="">Select Division</option>
              {DIVISIONS.map(division => (
                <option 
                  key={division} 
                  value={division}
                  disabled={isDivisionDisabled(division)}
                >
                  {division} {isDivisionDisabled(division) ? '(Already Submitted)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="submission_month">Submission Month *</label>
              <select
                id="submission_month"
                name="submission_month"
                value={formData.submission_month}
                onChange={handleInputChange}
                required
                className="form-control"
              >
                <option value="">Select Month</option>
                {MONTHS.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="submission_year">Submission Year *</label>
              <select
                id="submission_year"
                name="submission_year"
                value={formData.submission_year}
                onChange={handleInputChange}
                required
                className="form-control"
              >
                <option value="">Select Year</option>
                {YEARS.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="warehouse_hours">Warehouse Hours Worked *</label>
            <input
              type="number"
              id="warehouse_hours"
              name="warehouse_hours"
              value={formData.warehouse_hours}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              required
              className="form-control"
              placeholder="Enter hours worked"
            />
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Processing...' : (isEditMode ? 'Update Submission' : 'Submit Data')}
          </button>
        </form>

        <div className="info-box">
          <h3>Instructions:</h3>
          <ul>
            <li>Select your division from the dropdown menu</li>
            <li>Choose the submission month and year</li>
            <li>Enter the total warehouse hours worked</li>
            <li>Click Submit to save your data</li>
            <li>To edit: Click "View Submission Log" and click Edit on any entry</li>
            <li>Once submitted, that division is locked for this session (refresh to unlock)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;