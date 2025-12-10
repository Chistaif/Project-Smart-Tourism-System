import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // frame 1
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    // frame 2 (bắt buộc đối với trang ngắn)
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, 0);

  }, [pathname]);

  return null;
}
