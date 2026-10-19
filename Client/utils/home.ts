// What the G1Card logo does everywhere: signed in, a fresh load of your portal's dashboard;
// signed out, a reload of the current page.
const DASHBOARDS: Record<string, string> = {
    'Super Admin': '/admin/dashboard',
    Hospital: '/hospital/dashboard',
    Patient: '/patient/dashboard',
};

export function goHome() {
    let role = '';
    try {
        role = JSON.parse(localStorage.getItem('g1card_user') || 'null')?.role || '';
    } catch {
        role = '';
    }
    const target = DASHBOARDS[role];
    if (target) window.location.hash = `#${target}`;
    window.location.reload();
}
