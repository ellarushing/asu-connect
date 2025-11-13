/**
 * Design Patterns Implementation for ASU-Connect
 * Demonstrates common design patterns used in club and event management
 */

// ============================================================================
// 1. STRATEGY PATTERN
// For flexible sorting/filtering of clubs and events
// ============================================================================

interface Event {
  id: string;
  name: string;
  date: Date;
  popularity: number;
}

interface FilterStrategy {
  filter(events: Event[]): Event[];
}

class FilterByDate implements FilterStrategy {
  filter(events: Event[]): Event[] {
    return [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

class FilterByName implements FilterStrategy {
  filter(events: Event[]): Event[] {
    return [...events].sort((a, b) => a.name.localeCompare(b.name));
  }
}

class FilterByPopularity implements FilterStrategy {
  filter(events: Event[]): Event[] {
    return [...events].sort((a, b) => b.popularity - a.popularity);
  }
}

class EventFilterContext {
  private strategy: FilterStrategy;

  constructor(strategy: FilterStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: FilterStrategy): void {
    this.strategy = strategy;
  }

  executeFilter(events: Event[]): Event[] {
    return this.strategy.filter(events);
  }
}

// ============================================================================
// 2. OBSERVER PATTERN
// For notifications when events are created or updated
// ============================================================================

interface Observer {
  update(message: string): void;
}

class EmailNotifier implements Observer {
  private email: string;

  constructor(email: string) {
    this.email = email;
  }

  update(message: string): void {
    console.log(`[EMAIL] Sending to ${this.email}: ${message}`);
  }
}

class InAppNotifier implements Observer {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  update(message: string): void {
    console.log(`[IN-APP] Notification for user ${this.userId}: ${message}`);
  }
}

class EventSubject {
  private observers: Observer[] = [];

  attach(observer: Observer): void {
    this.observers.push(observer);
  }

  detach(observer: Observer): void {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  notify(message: string): void {
    this.observers.forEach((observer) => observer.update(message));
  }

  createEvent(eventName: string): void {
    this.notify(`New event created: ${eventName}`);
  }

  updateEvent(eventName: string, changes: string): void {
    this.notify(`Event "${eventName}" updated: ${changes}`);
  }
}

// ============================================================================
// 3. COMMAND PATTERN
// For undo/redo operations on events
// ============================================================================

interface Command {
  execute(): void;
  undo(): void;
}

class CreateEventCommand implements Command {
  private event: Event;
  private eventStore: Event[] = [];

  constructor(event: Event, eventStore: Event[]) {
    this.event = event;
    this.eventStore = eventStore;
  }

  execute(): void {
    this.eventStore.push(this.event);
    console.log(`[COMMAND] Event created: ${this.event.name}`);
  }

  undo(): void {
    const index = this.eventStore.indexOf(this.event);
    if (index > -1) {
      this.eventStore.splice(index, 1);
      console.log(`[COMMAND] Event creation undone: ${this.event.name}`);
    }
  }
}

class UpdateEventCommand implements Command {
  private event: Event;
  private previousState: Event;
  private newState: Partial<Event>;

  constructor(event: Event, updates: Partial<Event>) {
    this.event = event;
    this.previousState = { ...event };
    this.newState = updates;
  }

  execute(): void {
    Object.assign(this.event, this.newState);
    console.log(`[COMMAND] Event updated: ${this.event.name}`);
  }

  undo(): void {
    Object.assign(this.event, this.previousState);
    console.log(`[COMMAND] Event update undone: ${this.event.name}`);
  }
}

class CommandInvoker {
  private history: Command[] = [];
  private undoStack: Command[] = [];

  execute(command: Command): void {
    command.execute();
    this.history.push(command);
    this.undoStack = [];
  }

  undo(): void {
    const command = this.history.pop();
    if (command) {
      command.undo();
      this.undoStack.push(command);
    }
  }

  redo(): void {
    const command = this.undoStack.pop();
    if (command) {
      command.execute();
      this.history.push(command);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  // Strategy Pattern
  FilterStrategy,
  // Observer Pattern
  Observer,
  // Command Pattern
  Command,
  // Types
  Event,
};

export {
  // Strategy Pattern
  FilterByDate,
  FilterByName,
  FilterByPopularity,
  EventFilterContext,
  // Observer Pattern
  EmailNotifier,
  InAppNotifier,
  EventSubject,
  // Command Pattern
  CreateEventCommand,
  UpdateEventCommand,
  CommandInvoker,
};
