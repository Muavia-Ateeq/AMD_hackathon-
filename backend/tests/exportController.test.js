// backend/tests/exportController.test.js
// Tests for the export controller that serves batch_results.json

const fs = require('fs');
const path = require('path');

jest.mock('fs');

const { getExportResults } = require('../src/controllers/exportController');

describe('Export Controller', () => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  const next = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return JSON data when file exists', async () => {
    const fakeData = [{ fileName: 'doc1.pdf', id: 'doc-1' }];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(fakeData));

    await getExportResults({}, res, next);

    expect(fs.existsSync).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(fakeData);
    expect(res.status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('should respond 404 when results file missing', async () => {
    fs.existsSync.mockReturnValue(false);

    await getExportResults({}, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'Batch results not found' } });
    expect(next).not.toHaveBeenCalled();
  });
});
