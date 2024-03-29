import { SVGProps, forwardRef, Ref } from 'react';
const SvgMoon = (props: SVGProps<SVGSVGElement>, ref: Ref<SVGSVGElement>) => (
   <svg
      xmlns='http://www.w3.org/2000/svg'
      xmlSpace='preserve'
      viewBox='0 0 16 18'
      width={props.width || '100%'}
      height={props.height || '100%'}
      ref={ref}
      {...props}>
      <path d='M51.029 79.588a30.22 30.22 0 0 1-22.353-9.905c-5.409-5.968-8.169-13.686-7.774-21.729.396-8.045 3.901-15.454 9.869-20.862a29.88 29.88 0 0 1 11.766-6.599 2.002 2.002 0 0 1 2.417 2.667c-3.777 9.382-1.908 19.862 4.878 27.352a26.214 26.214 0 0 0 19.388 8.59c2.494 0 4.968-.354 7.353-1.051a2.001 2.001 0 0 1 2.418 2.667A29.915 29.915 0 0 1 71.27 71.78a30.102 30.102 0 0 1-20.241 7.808zM39.937 25.734a26.036 26.036 0 0 0-6.479 4.32c-5.177 4.691-8.217 11.117-8.56 18.095-.344 6.978 2.051 13.671 6.742 18.848a26.21 26.21 0 0 0 19.389 8.591 26.09 26.09 0 0 0 17.553-6.774 26.033 26.033 0 0 0 4.934-6.019 30.214 30.214 0 0 1-26.647-9.598c-6.742-7.439-9.275-17.843-6.932-27.463z' />
   </svg>
);
const ForwardRef = forwardRef(SvgMoon);
export default ForwardRef;
