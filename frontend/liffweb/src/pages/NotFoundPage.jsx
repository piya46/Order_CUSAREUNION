import React from "react";
import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h1>404</h1>
      <p>ไม่พบหน้านี้</p>
      <Link to="/">กลับหน้าแรก</Link>
    </div>
  );
};

export default NotFoundPage;