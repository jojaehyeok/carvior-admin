import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const STARS = [1, 2, 3, 4, 5];
const STAR_LABEL: Record<number, string> = {
  1: "매우 불만족",
  2: "불만족",
  3: "보통",
  4: "만족",
  5: "매우 만족",
};

export default function ReviewPage() {
  const router = useRouter();
  const { bookingId, driverId, driverName, carNumber, carOwner } = router.query as Record<string, string>;

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setPhotos(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async () => {
    if (!rating) { setError("별점을 선택해 주세요."); return; }
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("bookingId", bookingId || "");
      form.append("driverId", driverId || "");
      form.append("driverName", driverName || "");
      form.append("carNumber", carNumber || "");
      form.append("carOwner", carOwner || "");
      form.append("rating", String(rating));
      form.append("comment", comment);
      photos.forEach(f => form.append("photos", f));

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/reviews`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message || "제출 실패");
      }
      setDone(true);
    } catch (e: any) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ fontSize: 64, textAlign: "center" }}>🙏</div>
          <h2 style={{ textAlign: "center", marginBottom: 8 }}>소중한 리뷰 감사합니다!</h2>
          <p style={{ textAlign: "center", color: "#888" }}>
            더 나은 서비스로 보답하겠습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>서비스 리뷰 작성</title></Head>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>서비스는 어떠셨나요?</h2>
            {carNumber && <p style={{ color: "#888", margin: "6px 0 0" }}>{carNumber} 차량 진단</p>}
          </div>

          {/* 별점 */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            {STARS.map(s => (
              <button
                key={s}
                style={{ ...styles.starBtn, color: s <= (hover || rating) ? "#FAAD14" : "#ddd" }}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
              >
                ★
              </button>
            ))}
          </div>
          {(hover || rating) > 0 && (
            <p style={{ textAlign: "center", color: "#FAAD14", fontWeight: 600, marginBottom: 16 }}>
              {STAR_LABEL[hover || rating]}
            </p>
          )}

          {/* 한줄평 */}
          <textarea
            placeholder="서비스 경험을 자유롭게 작성해 주세요. (선택)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            maxLength={300}
            rows={4}
            style={styles.textarea}
          />
          <p style={{ textAlign: "right", fontSize: 12, color: "#aaa", marginTop: 4 }}>
            {comment.length}/300
          </p>

          {/* 사진 첨부 */}
          <label style={styles.photoLabel}>
            📷 사진 첨부 (최대 3장)
            <input type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: "none" }} />
          </label>
          {previews.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {previews.map((src, i) => (
                <img key={i} src={src} style={styles.preview} />
              ))}
            </div>
          )}

          {error && <p style={{ color: "#ff4d4f", marginTop: 12, fontSize: 14 }}>{error}</p>}

          <button
            style={{
              ...styles.submitBtn,
              backgroundColor: rating ? "#5B3FE6" : "#ccc",
              cursor: rating ? "pointer" : "not-allowed",
            }}
            onClick={handleSubmit}
            disabled={!rating || submitting}
          >
            {submitting ? "제출 중..." : "리뷰 제출하기"}
          </button>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    maxWidth: 480,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  starBtn: {
    background: "none",
    border: "none",
    fontSize: 44,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    transition: "color 0.1s",
  },
  textarea: {
    width: "100%",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    resize: "none",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  photoLabel: {
    display: "block",
    marginTop: 16,
    padding: "12px 16px",
    border: "1.5px dashed #d0d0d0",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
  preview: {
    width: 90,
    height: 90,
    objectFit: "cover",
    borderRadius: 8,
    border: "1px solid #eee",
  },
  submitBtn: {
    marginTop: 24,
    width: "100%",
    padding: "15px 0",
    borderRadius: 12,
    border: "none",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    transition: "background 0.2s",
  },
};
