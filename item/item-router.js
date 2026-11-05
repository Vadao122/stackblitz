import Router from '@koa/router';

export default function createItemRouter(controller) {
  const router = new Router({
    prefix: '/items',
  });

  router.get('/', controller.getItems.bind(controller));
  router.get('/:id', controller.getItem.bind(controller));
  router.post('/', controller.createItem.bind(controller));
  router.patch('/:id', controller.updateItem.bind(controller));
  router.delete('/:id', controller.deleteItem.bind(controller));

  return router;
}
