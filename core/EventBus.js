// Simple pub/sub event bus

const listeners = {}

export const EventBus = {
  on(event, fn) {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(fn)
  },
  off(event, fn) {
    if (!listeners[event]) return
    listeners[event] = listeners[event].filter(f => f !== fn)
  },
  emit(event, data) {
    if (!listeners[event]) return
    listeners[event].forEach(fn => fn(data))
  },
  once(event, fn) {
    const wrapper = (data) => { fn(data); this.off(event, wrapper) }
    this.on(event, wrapper)
  },
  clear(event) {
    if (event) delete listeners[event]
    else Object.keys(listeners).forEach(k => delete listeners[k])
  }
}
