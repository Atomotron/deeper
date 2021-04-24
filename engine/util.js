function isBareObject(obj) {
    return obj !== null &&
           typeof obj === "object" &&
           Object.getPrototypeOf(obj) === Object.prototype;
}

function deepAssign(target,source) {
    for (const name in source) {
        // Combine what needs to be combined
        if (name in target
            && isBareObject(target[name])
            && isBareObject(source[name])) {
            deepAssign(target[name],source[name]);
        } else {
            // Write the rest
            if (isBareObject(source[name])) {
                // Deep copy
                target[name] = {};
                deepAssign(target[name],source[name]);
            } else {
                target[name] = source[name]; // Shallow
            }
        }
    }
}

// Deep-combine several objects, the ones to the right overwriting the ones to the left.
export function SUM(...args) {
    const result = {};
    for (const a of args) {
        deepAssign(result,a);
    }
    return result;
}

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
            data = printTreeLines(v,nextIndent);
        } else {
            data = v.toString().split('\n');
        }
        if (data.length === 1) {
            lines.push(header + ' ' + data[0]);
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

// A helper function that can determine the names of a function's arguments.
// Copied, more or less, straight from angularjs source code
// https://github.com/angular/angular.js/blob/9bff2ce8fb170d7a33d3ad551922d7e23e9f82fc/src/auto/injector.js#L77
// NOTE: THIS CAN BE CONFUSED BY FUNCTION CALLS INSIDE DEFAULT ARGS
// (I won't bother fixing that because I won't be using it that way.)
export function extractArgs(fn) {
    const ARROW_ARG = /^([^(]+?)=>/;
    const FN_ARGS = /^[^(]*\(\s*([^)]*)\)/m;
    const FN_ARG_SPLIT = /,/;
    const FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    
    // Strip out function signature
    const strfn = fn.toString();
    const strfn_nocomments = strfn.replace(STRIP_COMMENTS, '');
    const signature = strfn_nocomments.match(ARROW_ARG) ||
                      strfn_nocomments.match(FN_ARGS);
    const args = signature[1].split(FN_ARG_SPLIT);
    // Patch to split when everything is an empty string
    if (args.every(x=>!x)) {
        return [];
    }
    return args;
}


// Finds the nearest power of two >= x
// Works when x <= 1073741824 (2^30)
export function nearestPowerOfTwoGreaterThanOrEqual(x) {
    if (x < 2) return x; // 1 and 0 won't work the method below
    return nearestPowerOfTwoLessThanOrEqual(x-1) << 1;
}

// Finds the nearest power of two <= x
// Works when x <= 1073741824 (2^30)
export function nearestPowerOfTwoLessThanOrEqual(x) {
    const leading_unsigned_zeros = Math.clz32(x)-1;
    return 0x4000_0000 >>> leading_unsigned_zeros;
}

