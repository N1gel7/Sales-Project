document.addEventListener('DOMContentLoaded', function () {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (sidebarToggle && sidebar && overlay) {
        sidebarToggle.addEventListener('click', function () {
            if (sidebar.classList.contains('sidebar-hidden')) {
                sidebar.classList.remove('sidebar-hidden');
                overlay.classList.add('hidden');
            } else {
                sidebar.classList.add('sidebar-hidden');
                overlay.classList.remove('hidden');
            }
        });
        overlay.addEventListener('click', function () {
            sidebar.classList.add('sidebar-hidden');
            overlay.classList.add('hidden');
        });
    }
});

