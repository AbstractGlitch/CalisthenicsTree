Icons go here: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.

The manifest in `vite.config.ts` references these three paths. Until they exist the app
still runs, but it will not install to a home screen cleanly -- and on iOS, installing is
what exempts the app from the 7-day storage eviction that would otherwise erase the log.
