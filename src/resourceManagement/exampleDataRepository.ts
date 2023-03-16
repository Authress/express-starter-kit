
class ExampleDataRepository {
  async getThing(thingId: string): Promise<Thing> {
    const thing: Thing = {};
    return thing;
  }

  async getAllThings(): Promise<Thing[]> {
    return [];
  }

  async updateThing(thingId: string, data: unknown): Promise<void> {
  }

  async deleteThing(thingId: string): Promise<void> {
  }

  async createThing(newThingId: string, data: unknown): Promise<void> {
  }
}

export default new ExampleDataRepository();

export interface Thing {
  thingId?: string;
  data?: unknown;
}