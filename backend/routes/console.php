<?php

use Illuminate\Support\Facades\Schedule;

/*
| Scheduled tasks (run by the `scheduler` container: php artisan schedule:work).
*/

// Privacy: delete server-side files past their 1-hour TTL.
Schedule::command('temp:cleanup')->everyMinute()->withoutOverlapping();

// TODO Phase 2/7:
// Schedule::command('credits:reset')->hourly();   // monthly grant/expiry on billing cycle
// Schedule::command('trials:expire')->hourly();    // downgrade expired trials + reminders
// Schedule::command('db:backup')->dailyAt('02:30'); // mysqldump + rotate
