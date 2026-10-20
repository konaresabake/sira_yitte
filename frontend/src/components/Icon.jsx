const PATHS = {
  cuir: 'M5 7c3-3 11-3 14 0v10c-3 3-11 3-14 0zM9 12h6',
  art: 'M20 4L7 17l-3 3M10 14l3 3M15 5l4 4',
  gar: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  liv: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 .01 0M17 19a1.5 1.5 0 1 0 .01 0',
  cmd: 'M4 5h16v11H9l-5 4z',
};
export default function Icon({ name }) {
  return <svg viewBox="0 0 24 24"><path d={PATHS[name]} /></svg>;
}
