import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import PayOS from "@payos/node";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID || "YOUR_CLIENT_ID",
  process.env.PAYOS_API_KEY || "YOUR_API_KEY",
  process.env.PAYOS_CHECKSUM_KEY || "YOUR_CHECKSUM_KEY"
);

app.post("/api/create-payment-link", async (req, res) => {
  const { amount, description, orderCode, returnUrl, cancelUrl } = req.body;

  try {
    const body = {
      orderCode: orderCode || Number(String(Date.now()).slice(-6)),
      amount: amount || 10000,
      description: description || "Thanh toan don hang",
      returnUrl: returnUrl || `http://localhost:5173/`,
      cancelUrl: cancelUrl || `http://localhost:5173/`,
    };

    const paymentLinkRes = await payos.createPaymentLink(body);

    return res.json({
      error: 0,
      message: "Success",
      data: {
        bin: paymentLinkRes.bin,
        checkoutUrl: paymentLinkRes.checkoutUrl,
        accountNumber: paymentLinkRes.accountNumber,
        accountName: paymentLinkRes.accountName,
        amount: paymentLinkRes.amount,
        description: paymentLinkRes.description,
        orderCode: paymentLinkRes.orderCode,
        qrCode: paymentLinkRes.qrCode,
      },
    });
  } catch (error: any) {
    console.error(error);
    return res.json({
      error: -1,
      message: "fail",
      data: null,
    });
  }
});

app.post("/api/payos-webhook", async (req, res) => {
  try {
    const webhookData = payos.verifyPaymentWebhookData(req.body);

    if (webhookData.code === "00") {
      // Payment success!
      console.log("Thanh toán thành công cho đơn hàng: ", webhookData.orderCode);
      // NOTE: Bạn cần cập nhật trạng thái đơn hàng trong DB ở đây
    }

    return res.json({
      error: 0,
      message: "Ok",
      data: webhookData,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      error: -1,
      message: "failed",
      data: null,
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
