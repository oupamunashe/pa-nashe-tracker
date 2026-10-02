/* The UI is a verbatim port of the prototype's JavaScript, which reads form values straight off
   querySelector() results. These overloads give those lookups the same (untyped) shape, so the ported
   code stays line-for-line comparable with prototype/src instead of being rewritten with casts. */
interface ParentNode {
  querySelector(selectors: string): any;
  querySelectorAll(selectors: string): NodeListOf<any>;
}
interface Element {
  closest(selectors: string): any;
}
