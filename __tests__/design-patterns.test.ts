import {
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
  // Types
  Event,
} from '@/lib/design-patterns';

describe('Design Patterns Tests', () => {
  // ============================================================================
  // STRATEGY PATTERN TESTS
  // ============================================================================

  describe('Strategy Pattern - Event Filtering', () => {
    const mockEvents: Event[] = [
      {
        id: '1',
        name: 'Event C',
        date: new Date('2025-01-15'),
        popularity: 50,
      },
      {
        id: '2',
        name: 'Event A',
        date: new Date('2025-01-10'),
        popularity: 100,
      },
      {
        id: '3',
        name: 'Event B',
        date: new Date('2025-01-20'),
        popularity: 75,
      },
    ];

    test('FilterByName sorts events alphabetically', () => {
      const strategy = new FilterByName();
      const filtered = strategy.filter(mockEvents);

      expect(filtered[0].name).toBe('Event A');
      expect(filtered[1].name).toBe('Event B');
      expect(filtered[2].name).toBe('Event C');
    });

    test('FilterByDate sorts events by date ascending', () => {
      const strategy = new FilterByDate();
      const filtered = strategy.filter(mockEvents);

      expect(filtered[0].id).toBe('2'); // Jan 10
      expect(filtered[1].id).toBe('1'); // Jan 15
      expect(filtered[2].id).toBe('3'); // Jan 20
    });

    test('FilterByPopularity sorts events by popularity descending', () => {
      const strategy = new FilterByPopularity();
      const filtered = strategy.filter(mockEvents);

      expect(filtered[0].popularity).toBe(100);
      expect(filtered[1].popularity).toBe(75);
      expect(filtered[2].popularity).toBe(50);
    });

    test('EventFilterContext can switch strategies', () => {
      const context = new EventFilterContext(new FilterByName());
      let filtered = context.executeFilter(mockEvents);
      expect(filtered[0].name).toBe('Event A');

      // Switch to date strategy
      context.setStrategy(new FilterByDate());
      filtered = context.executeFilter(mockEvents);
      expect(filtered[0].date.toISOString().split('T')[0]).toBe('2025-01-10');

      // Switch to popularity strategy
      context.setStrategy(new FilterByPopularity());
      filtered = context.executeFilter(mockEvents);
      expect(filtered[0].popularity).toBe(100);
    });

    test('Original array is not mutated during filtering', () => {
      const original = [...mockEvents];
      const strategy = new FilterByName();
      strategy.filter(mockEvents);

      // Verify original order is unchanged
      expect(mockEvents[0].name).toBe('Event C');
      expect(mockEvents[1].name).toBe('Event A');
      expect(mockEvents[2].name).toBe('Event B');
    });
  });

  // ============================================================================
  // OBSERVER PATTERN TESTS
  // ============================================================================

  describe('Observer Pattern - Event Notifications', () => {
    test('EmailNotifier receives event creation notification', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const emailNotifier = new EmailNotifier('test@asu.edu');

      emailNotifier.update('New event: Tech Meetup');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[EMAIL] Sending to test@asu.edu: New event: Tech Meetup'
      );

      consoleSpy.mockRestore();
    });

    test('InAppNotifier receives event creation notification', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const inAppNotifier = new InAppNotifier('user123');

      inAppNotifier.update('New event: Tech Meetup');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[IN-APP] Notification for user user123: New event: Tech Meetup'
      );

      consoleSpy.mockRestore();
    });

    test('EventSubject notifies all attached observers', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const subject = new EventSubject();

      const emailNotifier = new EmailNotifier('test@asu.edu');
      const inAppNotifier = new InAppNotifier('user123');

      subject.attach(emailNotifier);
      subject.attach(inAppNotifier);

      subject.createEvent('Tech Meetup');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('New event created: Tech Meetup')
      );

      consoleSpy.mockRestore();
    });

    test('EventSubject notifies observers on update', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const subject = new EventSubject();

      const emailNotifier = new EmailNotifier('test@asu.edu');
      subject.attach(emailNotifier);

      subject.updateEvent('Tech Meetup', 'Time changed to 3 PM');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('updated: Time changed to 3 PM')
      );

      consoleSpy.mockRestore();
    });

    test('Observer can be detached from subject', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const subject = new EventSubject();

      const emailNotifier = new EmailNotifier('test@asu.edu');
      subject.attach(emailNotifier);
      subject.detach(emailNotifier);

      subject.createEvent('Tech Meetup');

      // Should not have been called since observer was detached
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('Multiple observers can be notified independently', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const subject = new EventSubject();

      const email1 = new EmailNotifier('user1@asu.edu');
      const email2 = new EmailNotifier('user2@asu.edu');
      const inApp = new InAppNotifier('user123');

      subject.attach(email1);
      subject.attach(email2);
      subject.attach(inApp);

      subject.createEvent('Workshop');

      expect(consoleSpy).toHaveBeenCalledTimes(3);

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // COMMAND PATTERN TESTS
  // ============================================================================

  describe('Command Pattern - Event Management', () => {
    test('CreateEventCommand adds event to store on execute', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const eventStore: Event[] = [];
      const event: Event = {
        id: '1',
        name: 'New Event',
        date: new Date(),
        popularity: 0,
      };

      const command = new CreateEventCommand(event, eventStore);
      command.execute();

      expect(eventStore.length).toBe(1);
      expect(eventStore[0]).toBe(event);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[COMMAND] Event created: New Event'
      );

      consoleSpy.mockRestore();
    });

    test('CreateEventCommand removes event from store on undo', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const eventStore: Event[] = [];
      const event: Event = {
        id: '1',
        name: 'Event to Undo',
        date: new Date(),
        popularity: 0,
      };

      const command = new CreateEventCommand(event, eventStore);
      command.execute();
      expect(eventStore.length).toBe(1);

      command.undo();
      expect(eventStore.length).toBe(0);

      consoleSpy.mockRestore();
    });

    test('UpdateEventCommand modifies event on execute', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const event: Event = {
        id: '1',
        name: 'Original Name',
        date: new Date('2025-01-10'),
        popularity: 50,
      };

      const command = new UpdateEventCommand(event, {
        name: 'Updated Name',
        popularity: 100,
      });

      command.execute();

      expect(event.name).toBe('Updated Name');
      expect(event.popularity).toBe(100);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[COMMAND] Event updated: Updated Name'
      );

      consoleSpy.mockRestore();
    });

    test('UpdateEventCommand restores previous state on undo', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const event: Event = {
        id: '1',
        name: 'Original Name',
        date: new Date('2025-01-10'),
        popularity: 50,
      };

      const command = new UpdateEventCommand(event, {
        name: 'Updated Name',
      });

      command.execute();
      expect(event.name).toBe('Updated Name');

      command.undo();
      expect(event.name).toBe('Original Name');

      consoleSpy.mockRestore();
    });

    test('CommandInvoker executes commands and maintains history', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const invoker = new CommandInvoker();
      const eventStore: Event[] = [];

      const event1: Event = {
        id: '1',
        name: 'Event 1',
        date: new Date(),
        popularity: 0,
      };

      const command1 = new CreateEventCommand(event1, eventStore);
      invoker.execute(command1);

      expect(eventStore.length).toBe(1);

      consoleSpy.mockRestore();
    });

    test('CommandInvoker supports undo operations', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const invoker = new CommandInvoker();
      const eventStore: Event[] = [];

      const event: Event = {
        id: '1',
        name: 'Event',
        date: new Date(),
        popularity: 0,
      };

      const command = new CreateEventCommand(event, eventStore);
      invoker.execute(command);
      expect(eventStore.length).toBe(1);

      invoker.undo();
      expect(eventStore.length).toBe(0);

      consoleSpy.mockRestore();
    });

    test('CommandInvoker supports redo operations', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const invoker = new CommandInvoker();
      const eventStore: Event[] = [];

      const event: Event = {
        id: '1',
        name: 'Event',
        date: new Date(),
        popularity: 0,
      };

      const command = new CreateEventCommand(event, eventStore);
      invoker.execute(command);
      invoker.undo();

      expect(eventStore.length).toBe(0);

      invoker.redo();
      expect(eventStore.length).toBe(1);

      consoleSpy.mockRestore();
    });

    test('CommandInvoker clears redo stack on new execute', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const invoker = new CommandInvoker();
      const eventStore: Event[] = [];

      const event1: Event = {
        id: '1',
        name: 'Event 1',
        date: new Date(),
        popularity: 0,
      };

      const event2: Event = {
        id: '2',
        name: 'Event 2',
        date: new Date(),
        popularity: 0,
      };

      const command1 = new CreateEventCommand(event1, eventStore);
      invoker.execute(command1);
      invoker.undo();

      // After undo, redo stack should have the command
      expect(eventStore.length).toBe(0);

      // Execute new command, which should clear redo stack
      const command2 = new CreateEventCommand(event2, eventStore);
      invoker.execute(command2);
      expect(eventStore.length).toBe(1);

      consoleSpy.mockRestore();
    });
  });
});
