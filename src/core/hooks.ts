/* UI callbacks the data layer needs (toast, render). The UI registers the real ones at start-up;
   headless tests keep these no-ops. */
export const hooks = {
  toast: (_msg: string, _cls?: string) => {},
  scheduleRender: () => {},
  render: () => {},
};
