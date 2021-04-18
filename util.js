// Uses space characters to line up columns in the input lines
export function tabulate(title,rows) {
    const DIVIDER = '┊'; // Padding between columns
    const TOP = '▁';
    // convert to strings
    rows = rows.map(row => row.map(e => e.toString()));
    // Compute longest string in each column    
    const longest = [];
    for (const row of rows) {
        // Initialize to zero
        while (longest.length < row.length) {
            longest.push(0);
        }
        // Update longest
        for (let i=0; i<row.length; i++) {
            if (longest[i] < row[i].length) 
                longest[i] = row[i].length
        }
    }
    // Build the output strings
    const titleSpaces = longest.length*2 
                      - title.length
                      + longest.reduce((n,l) => l+n)
    const titleWings = TOP.repeat(Math.ceil(titleSpaces/2));
    const titleLine = titleWings + title + titleWings;
    const lines = [titleLine];
    for (const row of rows) {
        const line = [];
        for (let i=0; i<row.length; i++) {
            const padding = ' '.repeat(1+longest[i]-row[i].length);
            if (lines.length === 1) //first line
                line.push(row[i]+padding);
            else
                line.push(padding+row[i]);
        }
        lines.push(line.join(DIVIDER));
    }
    return lines.join('\n');
}
