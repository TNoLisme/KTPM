import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import PriceSidebar from "./PriceSidebar";
import Stepper from "./Stepper";
import { clearErrors, newOrder } from "../../actions/orderAction";
import { emptyCart } from "../../actions/cartAction";
import { useSnackbar } from "notistack";
import MetaData from "../Layouts/MetaData";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode"; // <--- IMPORT THƯ VIỆN MỚI (Logic only)

const Payment = () => {
	const dispatch = useDispatch();
	const navigate = useNavigate();
	const { enqueueSnackbar } = useSnackbar();

	// State lưu ảnh QR (dạng base64)
	const [qrCodeImage, setQrCodeImage] = useState(null);
	const [momoOrderId, setMomoOrderId] = useState(null);
	const [payDisable, setPayDisable] = useState(false);

	const paymentBtn = useRef(null);

	const { shippingInfo, cartItems } = useSelector((state) => state.cart);
	const { error } = useSelector((state) => state.newOrder);

	const totalPrice = cartItems.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0
	);

	const paymentData = {
		amount: Math.round(totalPrice),
		phoneNo: shippingInfo.phoneNo,
	};

	const order = {
		shippingInfo,
		orderItems: cartItems,
		totalPrice,
	};

	const submitHandler = async (e) => {
		e.preventDefault();

		// Safe check: đảm bảo ref tồn tại
		if (paymentBtn.current) paymentBtn.current.disabled = true;
		setPayDisable(true);

		try {
			const config = { headers: { "Content-Type": "application/json" } };

			const pipelinePayload = {
				shippingInfo: shippingInfo,
				orderItems: cartItems,
				paymentInfo: {
					id: "TEMP_ID", // ID tạm, backend sẽ sinh lại hoặc dùng Mock
					status: "PENDING",
				},
				totalPrice: totalPrice,
			};

			const { data } = await axios.post(
				"/api/v1/order/new", // Đường dẫn mới (Controller có Pipeline)
				pipelinePayload, // Payload đầy đủ cho Pipeline
				config
			);
			// 1. Kiểm tra nếu Backend trả về "succeeded" ngay (Trường hợp Load Test / Mock)
			if (process.env.LOAD_TEST_MODE === 'true' && data.paymentInfo && data.paymentInfo.status === "succeeded") {
				// Cập nhật Redux Store
				order.paymentInfo = {
					id: data.paymentInfo.id || data.paymentInfo.txnId,
					status: "succeeded",
				};

				//
				dispatch(emptyCart());

				enqueueSnackbar("Thanh toán thành công (Mock Mode)", {
					variant: "success",
				});
				// Chuyển hướng ngay đến trang thành công
				navigate("/orders/success");
				return; // Kết thúc hàm, không làm các bước QR code bên dưới
			}

			// 2. Nếu Backend trả về URL thanh toán (Trường hợp chạy thật)
			// Lấy link thanh toán từ backend
			const qrLink = data.paymentInfo.deeplink || data.paymentInfo.payUrl || data.paymentInfo.qrCodeUrl;

			if (qrLink) {
				// TẠO ẢNH QR TỪ LINK
				const generatedQR = await QRCode.toDataURL(qrLink);
				setQrCodeImage(generatedQR); // Lưu ảnh vào state
				setMomoOrderId(data.orderId);
				enqueueSnackbar("Vui lòng quét mã QR để hoàn tất thanh toán", {
					variant: "info",
				});
			} else {
				enqueueSnackbar("Không thể tạo giao dịch MoMo", { variant: "error" });
				setPayDisable(false);
				if (paymentBtn.current) paymentBtn.current.disabled = false;
			}
		} catch (err) {
			enqueueSnackbar(err?.response?.data?.message || err.message, {
				variant: "error",
			});
			setPayDisable(false);
			// Safe check: Sửa lỗi cannot set property of null
			if (paymentBtn.current) {
				paymentBtn.current.disabled = false;
			}
		}
	};

	// Polling kiểm tra trạng thái
	useEffect(() => {
		let interval;
		if (momoOrderId) {
			interval = setInterval(async () => {
				try {
					const { data } = await axios.get(
						`/api/v1/payment/status/${momoOrderId}`
					);

					if (data.status === "succeeded") {
						clearInterval(interval);

						order.paymentInfo = {
							id: data.paymentInfo.txnId,
							status: data.status,
						};

						dispatch(newOrder(order));
						dispatch(emptyCart());
						navigate("/orders/success");
					}
				} catch (error) {
					console.log("Waiting for payment...");
				}
			}, 3000);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [momoOrderId, dispatch, navigate, order]);

	useEffect(() => {
		if (error) {
			dispatch(clearErrors());
			enqueueSnackbar(error, { variant: "error" });
		}
	}, [dispatch, error, enqueueSnackbar]);

	return (
		<>
			<MetaData title="MoMo Payment" />

			<main className="w-full mt-20">
				<div className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-11/12 m-auto sm:mb-7">
					<div className="flex-1">
						<Stepper activeStep={3}>
							<div className="w-full bg-white p-6 min-h-[400px]">
								{!qrCodeImage ? (
									// GIAO DIỆN NÚT BẤM
									<form
										onSubmit={submitHandler}
										className="flex flex-col gap-4 w-full sm:w-3/4 mx-auto mt-8"
									>
										<div className="flex items-center gap-4 p-4 border rounded-lg bg-pink-50 border-pink-200">
											<img
												src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png"
												alt="MoMo Logo"
												className="w-12 h-12 object-contain"
											/>
											<div>
												<h3 className="font-bold text-gray-800">
													Ví điện tử MoMo
												</h3>
												<p className="text-sm text-gray-600">
													Quét mã QR để thanh toán an toàn
												</p>
											</div>
										</div>

										<input
											ref={paymentBtn}
											type="submit"
											value={`Thanh toán ${totalPrice.toLocaleString()}đ`}
											disabled={payDisable}
											className={`${
												payDisable
													? "bg-gray-400 cursor-not-allowed"
													: "bg-[#A50064] hover:bg-[#8d0055] cursor-pointer"
											} w-full py-3 font-bold text-white uppercase rounded shadow-md transition-all duration-300`}
										/>
									</form>
								) : (
									// GIAO DIỆN QR CODE (Dùng thẻ IMG chuẩn)
									<div className="flex flex-col items-center justify-center gap-6 animate-fade-in py-4">
										<h2 className="text-xl font-bold text-[#A50064]">
											Quét mã QR bằng ứng dụng MoMo
										</h2>

										<div className="relative p-2 border-4 border-[#A50064] rounded-xl shadow-lg bg-white">
											<img
												src={qrCodeImage}
												alt="MoMo QR Code"
												className="w-64 h-64 object-contain"
											/>
										</div>

										<div className="text-center">
											<p className="text-gray-800 font-medium text-lg">
												Tổng tiền:{" "}
												<span className="text-[#A50064] font-bold">
													{totalPrice.toLocaleString()}đ
												</span>
											</p>
											<div className="flex items-center justify-center gap-2 mt-2">
												<span className="relative flex h-3 w-3">
													<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
													<span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
												</span>
												<p className="text-gray-500 text-sm">
													Đang chờ xác nhận thanh toán...
												</p>
											</div>
											<p className="text-xs text-gray-400 mt-4">
												Vui lòng không tắt trình duyệt này.
											</p>
										</div>
									</div>
								)}
							</div>
						</Stepper>
					</div>

					<PriceSidebar cartItems={cartItems} />
				</div>
			</main>
		</>
	);
};

export default Payment;
