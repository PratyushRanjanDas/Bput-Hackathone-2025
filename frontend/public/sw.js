self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Solar Panel Optimizer', body: event.data ? event.data.text() : 'Update' };
  }
  const title = data.title || 'Solar Panel Optimizer';
  const options = {
    body: data.body || 'Energy loss exceeds threshold',
    icon: data.icon || '/favicon.ico',
    data: data.url || '/'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || '/'));
});
