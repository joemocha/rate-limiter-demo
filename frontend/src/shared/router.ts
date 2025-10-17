import type { RouteHandler } from './types';

class Router {
  private routes: Map<string, RouteHandler> = new Map();

  constructor() {
    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => this.handleRoute());

    // Intercept link clicks with data-route attribute
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        if (route) {
          this.navigate(route);
        }
      }
    });
  }

  register(path: string, handler: RouteHandler): void {
    this.routes.set(path, handler);
  }

  navigate(path: string): void {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  private handleRoute(): void {
    const path = window.location.pathname;
    const handler = this.routes.get(path);

    if (handler) {
      handler();
    } else {
      // 404 fallback - redirect to landing
      this.navigate('/');
    }
  }

  start(): void {
    this.handleRoute();
  }
}

// Export singleton instance
export const router = new Router();
