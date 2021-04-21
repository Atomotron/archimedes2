// Format and print a tree structre that's made of maps of (strings and maps of (...))
export function printTree(tree) {
    return printTreeLines(tree,'').join('\n');
}

function printTreeLines(tree,indent='') {
    const nextIndent = '  ' + indent; // Double-spaced indent
    const lines = [];
    for (const [k,v] of tree) {
        const header = `${indent}${k}:`;
        let data;
        if (v instanceof Map) {
            data = printTree(v,nextIndent);
        } else {
            data = v.toString().split('\n');
        }
        if (data.length === 1) {
            lines.push(header + data[0]);
        } else {
            lines.push(header);
            for (const row of data) {
                lines.push(nextIndent+row);
            }
        }
    }
    return lines;
}

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

// Less verbose undefinedness check.
export function isDefined(x) {
    return typeof x !== 'undefined';
}

export class RingBuffer {
    // Can be constructed with either a number N (fills with N nulls) 
    // or an array (fills with the array).
    constructor(buffer) {
        if (typeof buffer === 'number') {
            this.buf = [];
            for (let i=0; i<buffer; i++) {
                this.buf.push(null);
            }
        } else {
            this.buf = buffer;
        }
        this.i = 0;
    }
    // Increments the ring pointer
    next() {
        this.i = (this.i+1) % this.buf.length;    
    }
    // Advances the ring and puts an element at the pointer location.
    put(x) {
        this.buf[this.i] = x;
    }
    // Returns the value at the present pointer, the most recently put
    top() {
        return this.buf[this.i];
    }
    // Writes the ring in present-to-past order to the given array.
    dump(to=[]) {
        // The pointer backwards
        for (let i=this.i; i>=0; i--) {
            to.push(this.buf[i]);
        }
        // The end back to the pointer
        for (let i=this.buf.length-1; i > this.i; i--) {
            to.push(i);
        }
        return to;
    }
    
}
