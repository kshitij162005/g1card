// "Good morning" / "Good afternoon" / "Good evening" for the viewer's local time
export function timeOfDayGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour < 5) return 'Working late';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

export function firstName(name?: string) {
    return (name || '').trim().split(/\s+/)[0] || '';
}
