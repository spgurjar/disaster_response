const request = require('supertest');
const { app } = require('../index');

// Cursor generated API tests for disaster response platform

describe('Disaster Response Platform API Tests', () => {
  const testUser = 'netrunnerX';
  const testHeaders = { 'x-user': testUser };

  describe('Authentication', () => {
    test('should require x-user header', async () => {
      const response = await request(app).get('/disasters');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing user');
    });

    test('should accept valid users', async () => {
      const response = await request(app).get('/disasters').set(testHeaders);
      expect(response.status).not.toBe(401);
    });
  });

  describe('Disasters CRUD', () => {
    let disasterId;

    test('should create a disaster', async () => {
      const disasterData = {
        title: 'Test Flood',
        location_name: 'Test Location',
        description: 'Test description',
        tags: ['flood', 'test']
      };

      const response = await request(app)
        .post('/disasters')
        .set(testHeaders)
        .send(disasterData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe(disasterData.title);
      expect(response.body.owner_id).toBe(testUser);
      expect(response.body.audit_trail).toBeDefined();
      
      disasterId = response.body.id;
    });

    test('should get all disasters', async () => {
      const response = await request(app)
        .get('/disasters')
        .set(testHeaders);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should filter disasters by tag', async () => {
      const response = await request(app)
        .get('/disasters?tag=flood')
        .set(testHeaders);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should update a disaster', async () => {
      const updateData = {
        title: 'Updated Test Flood',
        location_name: 'Updated Location',
        description: 'Updated description',
        tags: ['flood', 'updated']
      };

      const response = await request(app)
        .put(`/disasters/${disasterId}`)
        .set(testHeaders)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe(updateData.title);
    });

    test('should delete a disaster', async () => {
      const response = await request(app)
        .delete(`/disasters/${disasterId}`)
        .set(testHeaders);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Social Media API', () => {
    test('should get social media posts', async () => {
      const response = await request(app)
        .get('/disasters/test-id/social-media')
        .set(testHeaders);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Resources API', () => {
    test('should get nearby resources', async () => {
      const response = await request(app)
        .get('/disasters/test-id/resources?lat=40.7128&lon=-74.0060')
        .set(testHeaders);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should require lat and lon parameters', async () => {
      const response = await request(app)
        .get('/disasters/test-id/resources')
        .set(testHeaders);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('lat and lon parameters are required');
    });
  });

  describe('Official Updates API', () => {
    test('should get official updates', async () => {
      const response = await request(app)
        .get('/disasters/test-id/official-updates')
        .set(testHeaders);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Image Verification API', () => {
    test('should verify image', async () => {
      const response = await request(app)
        .post('/disasters/test-id/verify-image')
        .set(testHeaders)
        .send({ image_url: 'https://example.com/test.jpg' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBeDefined();
      expect(response.body.confidence).toBeDefined();
    });

    test('should require image_url', async () => {
      const response = await request(app)
        .post('/disasters/test-id/verify-image')
        .set(testHeaders)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('image_url is required');
    });
  });

  describe('Geocoding API', () => {
    test('should geocode location', async () => {
      const response = await request(app)
        .post('/geocode')
        .set(testHeaders)
        .send({ description: 'Flood in Manhattan, NYC' });

      expect(response.status).toBe(200);
      expect(response.body.location_name).toBeDefined();
      expect(response.body.lat).toBeDefined();
      expect(response.body.lng).toBeDefined();
    });

    test('should require description', async () => {
      const response = await request(app)
        .post('/geocode')
        .set(testHeaders)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('description is required');
    });
  });

  describe('Root endpoint', () => {
    test('should return API info', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('Disaster Response Coordination Platform API');
    });
  });
}); 