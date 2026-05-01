import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appealsRouter from "./appeals";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/appeals", appealsRouter);

export default router;
