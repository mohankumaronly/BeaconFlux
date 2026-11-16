// Single responsibility: Express router configuration for provider endpoints.

import { Router } from 'express';
import {
  listProvidersHandler,
  createProviderHandler,
  updateProviderHandler,
  deleteProviderHandler,
  getProviderModelsHandler,
  testProviderHandler,
  getPresetsHandler,
} from './providers.controller.js';

export const providersRouter = Router();

providersRouter.get('/presets', getPresetsHandler);
providersRouter.get('/', listProvidersHandler);
providersRouter.post('/', createProviderHandler);
providersRouter.get('/:id/models', getProviderModelsHandler);
providersRouter.post('/:id/test', testProviderHandler);
providersRouter.patch('/:id', updateProviderHandler);
providersRouter.delete('/:id', deleteProviderHandler);
