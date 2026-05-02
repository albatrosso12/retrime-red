import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appealsRouter from "./appeals";
import authRouter from "./auth";
import verdictsRouter from "./verdicts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/appeals", appealsRouter);
router.use("/appeals", verdictsRouter);

export default router;
