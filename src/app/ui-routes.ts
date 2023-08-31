import { EventDispatcher } from "three";

interface Route {
  [path: string]: () => any
}

export class UIRouter extends EventDispatcher {
  constructor(public routes: Route = {}) {
    super()

    let context: any

    // The actual router, get the current URL and generate the corresponding template
    const router = () => {
      if (context) {
        context.dispose()
        this.dispatchEvent({ type: 'unload' })
      }

      const url = window.location.hash.slice(1) || "/";
      //try {
        console.log('loading', url)
        this.dispatchEvent({ type: 'load' })
        context = routes[url]()
      //} catch (error) {
      //  console.error(`Invalid route ${url}`)
      //}
    };

    window.addEventListener('load', router);
    window.addEventListener('hashchange', router);
  }

  add(path: string, example: () => any) {
    this.routes[path] = example
  }

  navigateto(route: string) {
    window.location.href = '#' + route
  }
}
