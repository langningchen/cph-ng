import type {
  AppEvent,
  IWebviewEventBus,
} from '@/application/ports/IWebviewEventBus';
import { sidebarProvider } from '@/utils/global';

export class WebviewEventBusAdapter implements IWebviewEventBus {
  publish<T = unknown>(event: AppEvent<T>): void {
    sidebarProvider.event.emit(event.type, event.payload as any);
  }
}

export default WebviewEventBusAdapter;
