export class QuestSubmissionGate<T> {
  private inFlight?: Promise<T>;
  private completed = false;

  submit(create: () => Promise<T>): Promise<T> {
    if (this.completed)
      return Promise.reject(new Error("REQUEST_ALREADY_COMPLETED"));
    if (this.inFlight) return this.inFlight;
    this.inFlight = create()
      .then((result) => {
        this.completed = true;
        return result;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }
}
