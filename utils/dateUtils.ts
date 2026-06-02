
export function groupItemsByDate(items: any[], dateField: string = 'createdAt') {
    const groups: { [key: string]: any[] } = {};

    items.forEach(item => {
        const date = new Date(item[dateField]);
        const now = new Date();

        const isToday = date.toDateString() === now.toDateString();

        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        let groupKey = '';
        if (isToday) {
            groupKey = 'Today';
        } else if (isYesterday) {
            groupKey = 'Yesterday';
        } else {
            groupKey = date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        }

        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(item);
    });

    // Sort group keys: Today first, then Yesterday, then by date descending
    return Object.entries(groups).sort((a, b) => {
        if (a[0] === 'Today') return -1;
        if (b[0] === 'Today') return 1;
        if (a[0] === 'Yesterday') return -1;
        if (b[0] === 'Yesterday') return 1;

        // Parse the dates for comparison
        const dateA = new Date(a[1][0][dateField]);
        const dateB = new Date(b[1][0][dateField]);
        return dateB.getTime() - dateA.getTime();
    });
}

export function formatTimeHM(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
}
