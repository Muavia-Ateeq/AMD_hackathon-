// backend/tests/exportController.test.js
// Tests for the export controller that serves batch_results.json

const fs = require('fs');
const path = require('path');

jest.mock('fs');

const { getExportResults, RESULTS_PATH, EVAL_PATH } = require('../src/controllers/exportController');

describe('Export Controller', () => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  const next = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return JSON data when file exists', async () => {
    const fakeData = [{ fileName: 'doc1.pdf', id: 'doc-1' }];
    const evalData = { fieldAccuracy: 0.97 };
    // Batch results exist, evaluation summary does not: serve the raw payload.
    fs.existsSync.mockImplementation(p => p === RESULTS_PATH);
    fs.readFileSync.mockReturnValue(JSON.stringify(fakeData));

    await getExportResults({}, res, next);

    expect(fs.existsSync).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(fakeData);
    expect(res.status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches the evaluation summary when it exists', async () => {
    const fakeData = [{ fileName: 'doc1.pdf', id: 'doc-1' }];
    const evalData = { fieldAccuracy: 0.97 };
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation(p =>
      p === EVAL_PATH ? JSON.stringify(evalData) : JSON.stringify(fakeData)
    );

    await getExportResults({}, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.eval).toEqual(evalData);
    expect(payload[0]).toEqual(fakeData[0]);
  });

  test('should respond 404 when results file missing', async () => {
    fs.existsSync.mockReturnValue(false);

    await getExportResults({}, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: expect.stringContaining('Batch results not found') }
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('resolves the results path inside backend/, not backend/backend/', () => {
    // A duplicated path segment previously guaranteed a permanent 404.
    expect(RESULTS_PATH).not.toMatch(/backend[\\/]backend/);
    expect(RESULTS_PATH.endsWith(path.join('metrics', 'batch_results.json'))).toBe(true);
  });
});
