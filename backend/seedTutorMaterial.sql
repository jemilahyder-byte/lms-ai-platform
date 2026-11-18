BEGIN;

UPDATE lectures
SET transcript = 'Sample learning material for the AI Tutor demo.

JavaScript adds interactive behaviour to web pages. JavaScript can also run on a server using Node.js.

Variables store values. Use let for a block-scoped variable whose value can be reassigned. Use const for a block-scoped binding that cannot be reassigned. Use var for a function-scoped variable.

JavaScript has number, string, boolean, undefined, null, bigint and symbol primitive values. Arrays and objects are objects.

Adding the numbers 2 and 3 produces 5. Adding the strings "2" and "3" produces "23".

A function is a reusable block of code. Parameters receive inputs, and return sends a result back to the caller.

Use console.log to display a value while debugging.'
WHERE id = '77dc7f4f-bb22-4ee5-8002-ae782af8a8b3'
  AND transcript = 'Welcome to JavaScript Basics.';

COMMIT;