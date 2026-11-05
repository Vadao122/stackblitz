import Koa from 'koa';
import BodyParser from 'koa-bodyparser';
import { ApiError } from './errors.js';
import ItemController from './item/item-controller.js';
import createItemRouter from './item/item-router.js';

export function createApp(linker) {
  const app = new Koa();
  const controller = new ItemController(linker);
  const router = createItemRouter(controller);

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      const isApiError = err instanceof ApiError;
      const status = isApiError
        ? err.status
        : Number.isInteger(err.status)
          ? err.status
          : 500;

      const code = isApiError
        ? err.code
        : status < 500
          ? 'BAD_REQUEST'
          : 'INTERNAL_ERROR';

      ctx.status = status;
      ctx.body = {
        error: {
          code,
          message: status >= 500 ? 'Внутренняя ошибка сервера' : err.message,
          ...(isApiError && err.details ? { details: err.details } : {}),
        },
      };

      if (status >= 500) {
        ctx.app.emit('error', err, ctx);
      }
    }
  });

  app.use(BodyParser({ jsonLimit: '1mb' }));
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.use((ctx) => {
    if (ctx.status !== 404) return;

    ctx.status = 404;
    ctx.body = {
      error: {
        code: 'NOT_FOUND',
        message: 'Маршрут не найден',
      },
    };
  });

  app.on('error', (err) => {
    console.error(err);
  });

  return app;
}
