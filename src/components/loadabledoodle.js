import Loadable from "@loadable/component";

const LoadableDoodle = Loadable(() => import("./doodle"));

export default LoadableDoodle;
