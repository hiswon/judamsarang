import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ChangeEvent, MouseEvent, TouchEvent } from 'react';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  deleteDoc,
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  Timestamp 
} from 'firebase/firestore';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  PenTool, 
  X, 
  Search, 
  Sun, 
  Cloud, 
  Umbrella, 
  ChevronDown, 
  ChevronUp, 
  LogOut,
  Lock,
  Trash2,
  BookOpen,
  Info,
  Globe,
  HeartHandshake,
  CreditCard,
  Sparkles
} from 'lucide-react';

import { auth, db } from './firebase';
import './App.css';

// ==========================================
// 관리자 계정 정보 설정
// ==========================================
const ALLOWED_ADMINS = ['judam1', 'judam2', 'judam3'];
const DOMAIN_SUFFIX = '@father-app.com';

// ==========================================
// Type Definitions
// ==========================================
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  title: string;
  content: string;
  tags: string[];
  weather: string;
  mood: string;
  drawingUrl?: string;
  likes: string[];
  comments: Comment[];
  createdAt: Timestamp | null;
}

interface PostCardProps {
  post: Post;
  currentUserId: string | null;
  adminId: string;
  onToggleLike: (postId: string, currentLikes: string[]) => void;
  onAddComment: (postId: string, commentText: string) => void;
  onDeleteComment: (postId: string, comment: Comment) => void;
  onDeletePost: (postId: string) => void;
  onSelectTag: (tag: string) => void;
}

// ==========================================
// Main Component
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState<'info' | 'journal'>('info');
  const [user, setUser] = useState<User | null>(null);
  const [adminId, setAdminId] = useState<string>('');
  
  // 로그인 폼 상태
  const [showLoginForm, setShowLoginForm] = useState<boolean>(false);
  const [loginInputId, setLoginInputId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [visitorName] = useState<string>(() => localStorage.getItem('journal_nickname') || '방문자');

  // 게시글 관련 상태
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedWeather, setSelectedWeather] = useState<string>('맑음');
  const [selectedMood, setSelectedMood] = useState<string>('평온');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Canvas State
  const [isCanvasOpen, setIsCanvasOpen] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email) {
        const id = currentUser.email.split('@')[0];
        if (ALLOWED_ADMINS.includes(id)) {
          setUser(currentUser);
          setAdminId(id);
          return;
        }
      }
      setUser(null);
      setAdminId('');
    });
    return () => unsubscribe();
  }, []);

  // Firestore Realtime Posts
  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const unsubscribe = onSnapshot(postsRef, (snapshot) => {
      const fetchedPosts: Post[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || '',
          authorName: data.authorName || '관리자',
          title: data.title || '',
          content: data.content || '',
          tags: data.tags || [],
          weather: data.weather || '맑음',
          mood: data.mood || '평온',
          drawingUrl: data.drawingUrl || null,
          likes: data.likes || [],
          comments: data.comments || [],
          createdAt: data.createdAt || null,
        };
      });

      fetchedPosts.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setPosts(fetchedPosts);
    });

    return () => unsubscribe();
  }, []);

  // 관리자 로그인 처리
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const cleanId = loginInputId.trim();

    if (!ALLOWED_ADMINS.includes(cleanId)) {
      alert("허용된 관리자 아이디가 아닙니다. (judam1, judam2, judam3)");
      return;
    }

    if (loginPassword !== '123456') {
      alert("비밀번호가 올바르지 않습니다.");
      return;
    }

    const email = `${cleanId}${DOMAIN_SUFFIX}`;

    try {
      await signInWithEmailAndPassword(auth, email, loginPassword);
      setShowLoginForm(false);
      setLoginInputId('');
      setLoginPassword('');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, email, loginPassword);
          setShowLoginForm(false);
          setLoginInputId('');
          setLoginPassword('');
        } catch (createErr) {
          console.error("계정 생성 실패:", createErr);
          alert("로그인 처리 중 오류가 발생했습니다.");
        }
      } else {
        console.error("로그인 실패:", err);
        alert("로그인에 실패했습니다.");
      }
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("로그아웃 실패:", err);
    }
  };

  // Canvas Handlers
  const startDrawing = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(clientX - rect.left, clientY - rect.top);
    }
  };

  const draw = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (ctx) {
      ctx.lineTo(clientX - rect.left, clientY - rect.top);
      ctx.stroke();
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setDrawingDataUrl(canvas.toDataURL());
      setIsCanvasOpen(false);
    }
  };

  // Tag Handlers
  const handleAddTag = (e: FormEvent) => {
    e.preventDefault();
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim().replace(/^#/, '')]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Submit Post
  const handleSubmitPost = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !adminId) {
      alert("관리자만 글을 작성할 수 있습니다.");
      return;
    }
    if (!content.trim()) return;

    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        authorName: adminId,
        title: title.trim(),
        content: content.trim(),
        tags,
        weather: selectedWeather,
        mood: selectedMood,
        drawingUrl: drawingDataUrl,
        likes: [],
        comments: [],
        createdAt: Timestamp.now()
      });

      setContent('');
      setTitle('');
      setTags([]);
      setDrawingDataUrl(null);
    } catch (err) {
      console.error("글 저장 실패:", err);
      alert("글 저장에 실패했습니다.");
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("정말로 이 글을 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      console.error("글 삭제 실패:", err);
      alert("글 삭제 중 오류가 발생했습니다.");
    }
  };

  // Like Toggle
  const handleToggleLike = async (postId: string, currentLikes: string[]) => {
    const postRef = doc(db, 'posts', postId);
    const identifier = user ? user.uid : 'anonymous_visitor';
    const hasLiked = currentLikes.includes(identifier);

    try {
      if (hasLiked) {
        await updateDoc(postRef, { likes: arrayRemove(identifier) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(identifier) });
      }
    } catch (err) {
      console.error("좋아요 업데이트 오류:", err);
    }
  };

  // Comment Add
  const handleAddComment = async (postId: string, commentText: string) => {
    if (!commentText.trim()) return;
    const postRef = doc(db, 'posts', postId);
    
    const newComment: Comment = {
      id: Date.now().toString(),
      userId: user ? user.uid : 'visitor_' + Math.random().toString(36).substr(2, 5),
      userName: adminId ? `[관리자] ${adminId}` : visitorName,
      text: commentText.trim(),
      createdAt: new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    try {
      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });
    } catch (err) {
      console.error("댓글 추가 오류:", err);
    }
  };

  // Comment Delete
  const handleDeleteComment = async (postId: string, commentToDelete: Comment) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    const postRef = doc(db, 'posts', postId);
    try {
      await updateDoc(postRef, {
        comments: arrayRemove(commentToDelete)
      });
    } catch (err) {
      console.error("댓글 삭제 오류:", err);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.content.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <h1 className="app-title">NEW LIFE FOUNDATION</h1>
        <div className="header-user-info">
          {adminId ? (
            <>
              <span className="admin-badge">👑 {adminId}</span>
              <button onClick={handleLogout} className="logout-btn" title="로그아웃">
                <LogOut style={{ width: 14, height: 14 }} />
              </button>
            </>
          ) : (
            <button onClick={() => setShowLoginForm(!showLoginForm)} className="login-toggle-btn">
              관리자 로그인
            </button>
          )}
        </div>
      </header>

      {/* Main Tab Navigation */}
      <nav className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <Info style={{ width: 16, height: 16 }} />
          <span>선교회 소개</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'journal' ? 'active' : ''}`}
          onClick={() => setActiveTab('journal')}
        >
          <BookOpen style={{ width: 16, height: 16 }} />
          <span>선교 일기 & 소식</span>
        </button>
      </nav>

      <main className="app-main">
        {/* 관리자 로그인 폼 */}
        {showLoginForm && !adminId && (
          <section className="auth-card">
            <h3 className="auth-card-title">관리자 로그인</h3>
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-input-group">
                <input
                  type="text"
                  placeholder="아이디 (judam1, judam2, judam3)"
                  value={loginInputId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setLoginInputId(e.target.value)}
                  className="auth-input"
                />
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={loginPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setLoginPassword(e.target.value)}
                  className="auth-input"
                />
              </div>
              <button type="submit" className="auth-submit-btn">
                로그인
              </button>
            </form>
          </section>
        )}

        {/* ==================== TAB 1: 선교회 소개 (전면 게시) ==================== */}
        {activeTab === 'info' && (
          <section className="info-tab-content">
            <div className="hero-banner">
              <div className="hero-badge">NEW LIFE FOUNDATION</div>
              <h2 className="hero-title">탄자니아 선교회</h2>
              <p className="hero-subtitle">Tanzania Mission</p>
            </div>

            {/* 사진갤러리 및 현장 모습 */}
            <div className="photo-section">
              <div className="main-photo-card">
                <img 
                  src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800&auto=format&fit=crop" 
                  alt="탄자니아 아이들" 
                  className="hero-image" 
                />
                <div className="photo-caption">사랑과 소망으로 자라나는 탄자니아 어린이들</div>
              </div>

              <div className="photo-grid">
                <div className="grid-photo-item">
                  <img src="https://images.unsplash.com/photo-1509099836639-18ba1795216d?q=80&w=400&auto=format&fit=crop" alt="의료 선교" />
                  <span>의료 & 복음 선교</span>
                </div>
                <div className="grid-photo-item">
                  <img src="https://images.unsplash.com/photo-1542810634-71277d95dcbb?q=80&w=400&auto=format&fit=crop" alt="학원 선교" />
                  <span>청소년 학원 선교</span>
                </div>
              </div>
            </div>

            {/* 본문 소개 카드 */}
            <article className="info-card">
              <p className="info-intro">
                본 선교회는 <strong>탄자니아(Moshi)</strong>를 중심으로 동아프리카를 복음화하고자하는 선교단체입니다.
              </p>
              
              <div className="info-body">
                <p>
                  지금 아프리카는 최첨단 과학문명이 발달한 오늘날 세계속에서도 과거 400년동안 식민지의 착취와 약탈과 노예로 땅이 황폐화되고 산업도, 상업도없이 가난과 질병과 무지 가운데서 비참하게 살아가는 곳입니다.
                </p>
                <p>
                  이러한 곳에 가장 효과적인 선교인 자라나는 청소년들(학원 선교를 통해서)에게 복음을 전하고 그리고 불치의 병이라 불리우는 에이즈 환자들에게 (의료선교를 통해서) 복음을 전해서 이들의 삶과 영혼을 구원하는데 목적을 하고 있습니다.
                </p>
              </div>

              <div className="slogan-box">
                <Globe style={{ width: 18, height: 18, display: 'inline-block', marginRight: 6 }} />
                <span>A PLACE WHERE WORLD-TRANSFORMERS ARE TRANSFORMED</span>
              </div>
            </article>

            {/* =======================================================
                [추가 영역] 1. 본 선교회에 동참하는 길
               ======================================================= */}
            <article className="info-card section-card">
              <div className="section-header-badge red-badge">
                <HeartHandshake style={{ width: 16, height: 16 }} />
                <span>본 선교회에 동참하는 길</span>
              </div>

              <div className="feature-list">
                <div className="feature-item">
                  <h4 className="feature-num">1. 가난한 가정의 자녀들이 학교에서 공부할 수 있도록 도와 주는 일.</h4>
                  <p className="feature-desc">
                    • 가난하여 학교에 다닐 수 없는 아이에게 하루 한끼 식사와 교재, 학용품 등을 제공하여 학교에 다닐 수 있게 함.
                  </p>
                </div>

                <div className="feature-item">
                  <h4 className="feature-num">2. 부모없는 고아들이 공부할 수 있도록 도와 주는 일.</h4>
                  <p className="feature-desc">
                    • 이 곳에는 에이즈나 말라리아 병으로 부모가 일찍 죽거나 그리고 성 교육 부재로 부모없는 고아가 많음.
                  </p>
                </div>

                <div className="feature-item">
                  <h4 className="feature-num">3. 에이즈 환자 가족이 생존할 수 있도록 도와 주는 일.</h4>
                  <p className="feature-desc">
                    • 아프리카에서 에이즈 환자가 가장 많은 곳 중 한 곳이 탄자니아이며(150만명 이상 추정) 이 에이즈에 걸린 환자들이 제대로 치료와 도움을 받지못하고 죽어가는 곳임.
                  </p>
                </div>
              </div>
            </article>

            {/* =======================================================
                [추가 영역] 2. 기도제목
               ======================================================= */}
            <article className="info-card section-card">
              <div className="section-header-banner blue-banner">
                <Sparkles style={{ width: 16, height: 16 }} />
                <span>기도제목</span>
              </div>

              <div className="prayer-list">
                <div className="prayer-item">
                  <h4 className="prayer-title">1. 탄자니아 선교회를 위하여.</h4>
                  <p className="prayer-desc">• 본 선교회를 통하여 이 땅 주민들이 복음을 받아들이고 영육간에 구원을 받게하소서.</p>
                </div>

                <div className="prayer-item">
                  <h4 className="prayer-title">2. 탄자니아 사역을 위해서.</h4>
                  <ul className="prayer-sublist">
                    <li>1) 가난한 가정의 자녀들이 "학교에 가서 공부하고싶다"는 그들의 꿈이 이뤄지게 하소서.</li>
                    <li>2) 부모없는 고아들이 최소한의 보호를 받고 다른 아이들처럼 학교에 다닐 수 있게 하소서.</li>
                    <li>3) 에이즈 환자들에게 치료와 도움의 손길이 이어지게 하소서.</li>
                  </ul>
                </div>

                <div className="prayer-item">
                  <h4 className="prayer-title">3. 협력 선교사를 위하여.</h4>
                  <p className="prayer-desc">• 본 선교회가 협력 선교사로 파송한 김상재 목사의 안전과 사역과 건강을 지켜주옵소서.</p>
                </div>
              </div>
            </article>

            {/* =======================================================
                [추가 영역] 3. 선교 후원 계좌 안내
               ======================================================= */}
            <article className="info-card donate-card">
              <div className="donate-header">
                <CreditCard style={{ width: 18, height: 18 }} />
                <span>선교 후원 계좌</span>
              </div>

              <div className="donate-box">
                <p className="donate-info-text">탄자니아 선교와 후원에 동참해주실 분들을 기다립니다.</p>
                {/* 필요에 따라 실제 계좌번호 및 상세 연락처로 수정할 수 있습니다 */}
                <div className="account-details">
                  <div className="account-row">
                    <span className="account-label">후원 문의:</span>
                    <span className="account-value">김상재 목사 / 탄자니아 선교회</span>
                  </div>
                </div>
              </div>
            </article>
          </section>
        )}

        {/* ==================== TAB 2: 기존 글 저장앱 (선교 일기 & 소식) ==================== */}
        {activeTab === 'journal' && (
          <section className="journal-tab-content">
            {/* Search Bar */}
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="태그나 키워드로 소식을 검색해보세요..."
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Editor Card (관리자 작성) */}
            {adminId ? (
              <section className="editor-card">
                <input
                  type="text"
                  placeholder="오늘 소식의 제목 (선택)"
                  value={title}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  className="editor-title"
                />

                <textarea
                  rows={4}
                  placeholder="탄자니아 현지 소식과 기도제목을 기록해주세요..."
                  value={content}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                  className="editor-textarea"
                />

                {drawingDataUrl && (
                  <div className="drawing-preview">
                    <img src={drawingDataUrl} alt="내 그림 예시" />
                    <button onClick={() => setDrawingDataUrl(null)} className="preview-close">
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="tag-list">
                    {tags.map((tag) => (
                      <span key={tag} className="tag-badge">
                        #{tag}
                        <button onClick={() => handleRemoveTag(tag)}>
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddTag}>
                  <input
                    type="text"
                    placeholder="태그 입력 후 Enter (#탄자니아)"
                    value={tagInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
                    className="tag-input"
                  />
                </form>

                <div className="editor-toolbar">
                  <div className="selector-group">
                    <div className="option-group">
                      <span>날씨:</span>
                      {['맑음', '구름', '비'].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setSelectedWeather(w)}
                          className={`option-btn ${selectedWeather === w ? 'active' : ''}`}
                        >
                          {w === '맑음' && <Sun style={{ width: 14, height: 14 }} />}
                          {w === '구름' && <Cloud style={{ width: 14, height: 14 }} />}
                          {w === '비' && <Umbrella style={{ width: 14, height: 14 }} />}
                        </button>
                      ))}
                    </div>

                    <div className="option-group">
                      <span>상태:</span>
                      {['평온', '기쁨', '은혜'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedMood(m)}
                          className={`text-option-btn ${selectedMood === m ? 'active' : ''}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="toolbar-actions">
                    <button
                      type="button"
                      onClick={() => setIsCanvasOpen(true)}
                      className="tool-icon-btn"
                      title="손그림 스케치"
                    >
                      <PenTool style={{ width: 16, height: 16 }} />
                    </button>
                    
                    <button type="button" onClick={handleSubmitPost} className="submit-btn">
                      <Send style={{ width: 14, height: 14 }} />
                      <span>남기기</span>
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <div className="admin-notice">
                <Lock style={{ width: 16, height: 16, display: 'block', margin: '0 auto 0.25rem' }} />
                선교 소식 및 일기 작성 권한은 지정된 관리자만 사용할 수 있습니다.
              </div>
            )}

            {/* Post List */}
            <section className="post-list">
              {filteredPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9E8E81', fontSize: '0.875rem' }}>
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 선교 소식이 없습니다.'}
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user ? user.uid : 'anonymous_visitor'}
                    adminId={adminId}
                    onToggleLike={handleToggleLike}
                    onAddComment={handleAddComment}
                    onDeleteComment={handleDeleteComment}
                    onDeletePost={handleDeletePost}
                    onSelectTag={(t) => setSearchQuery(t)}
                  />
                ))
              )}
            </section>
          </section>
        )}
      </main>

      {/* Drawing Canvas Modal */}
      {isCanvasOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                <PenTool style={{ width: 16, height: 16 }} /> 손그림 스케치
              </h3>
              <button onClick={() => setIsCanvasOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: 16, height: 16, color: '#8C7A6B' }} />
              </button>
            </div>
            
            <div className="canvas-wrapper">
              <canvas
                ref={canvasRef}
                width={320}
                height={240}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="canvas-element"
              />
            </div>

            <div className="modal-actions">
              <button onClick={clearCanvas} className="clear-btn">
                지우기
              </button>
              <button onClick={saveCanvas} className="save-canvas-btn">
                첨부하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Post Card Component
// ==========================================
function PostCard({ 
  post, 
  currentUserId, 
  adminId, 
  onToggleLike, 
  onAddComment, 
  onDeleteComment,
  onDeletePost,
  onSelectTag 
}: PostCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState<string>('');

  const lines = post.content.split('\n');
  const isLongContent = lines.length > 5 || post.content.length > 200;

  const displayContent = isExpanded || !isLongContent
    ? post.content
    : lines.slice(0, 5).join('\n').slice(0, 180) + '...';

  const hasLiked = currentUserId ? post.likes.includes(currentUserId) : false;

  const handleCommentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (commentInput.trim()) {
      onAddComment(post.id, commentInput);
      setCommentInput('');
    }
  };

  return (
    <article className="post-card">
      <div className="post-card-header">
        <div className="author-info">
          <span className="author-name">{post.authorName}</span>
          <span>•</span>
          <span className="badge-sm">{post.weather}</span>
          <span className="badge-sm">{post.mood}</span>
        </div>
        <div className="header-right-actions">
          <span>
            {post.createdAt ? new Date(post.createdAt.toMillis()).toLocaleDateString('ko-KR', {
              month: 'short',
              day: 'numeric'
            }) : '방금 전'}
          </span>
          {adminId && (
            <button 
              onClick={() => onDeletePost(post.id)} 
              className="delete-icon-btn"
              title="게시글 삭제"
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {post.title && <h2 className="post-card-title">{post.title}</h2>}

      {post.drawingUrl && (
        <div className="post-drawing">
          <img src={post.drawingUrl} alt="손그림" />
        </div>
      )}

      <div className="post-content">{displayContent}</div>

      {isLongContent && (
        <button onClick={() => setIsExpanded(!isExpanded)} className="expand-btn">
          {isExpanded ? (
            <>접기 <ChevronUp style={{ width: 12, height: 12 }} /></>
          ) : (
            <>더보기 <ChevronDown style={{ width: 12, height: 12 }} /></>
          )}
        </button>
      )}

      {post.tags.length > 0 && (
        <div className="tag-list">
          {post.tags.map((tag, idx) => (
            <button key={idx} onClick={() => onSelectTag(tag)} className="tag-badge" style={{ cursor: 'pointer' }}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="action-row">
        <button
          onClick={() => onToggleLike(post.id, post.likes)}
          className={`action-btn ${hasLiked ? 'liked' : ''}`}
        >
          <Heart style={{ width: 16, height: 16 }} />
          <span>{post.likes.length}</span>
        </button>

        <button onClick={() => setShowComments(!showComments)} className="action-btn">
          <MessageCircle style={{ width: 16, height: 16 }} />
          <span>{post.comments.length}</span>
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          <div className="post-list" style={{ gap: '0.5rem' }}>
            {post.comments.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: '#B5A89B', fontStyle: 'italic' }}>
                첫 번째 공감 댓글을 달아주세요.
              </p>
            ) : (
              post.comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <span style={{ fontWeight: 600, color: '#3A2E2B' }}>{comment.userName}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{comment.createdAt}</span>
                      {(adminId || comment.userId === currentUserId) && (
                        <button 
                          onClick={() => onDeleteComment(post.id, comment)} 
                          className="delete-comment-btn"
                          title="댓글 삭제"
                        >
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="comment-text">{comment.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCommentSubmit} className="comment-form">
            <input
              type="text"
              placeholder="응원의 댓글을 남겨보세요..."
              value={commentInput}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCommentInput(e.target.value)}
              className="comment-input"
            />
            <button type="submit" className="comment-submit-btn">
              등록
            </button>
          </form>
        </div>
      )}
    </article>
  );
}