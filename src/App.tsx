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
  Lock
} from 'lucide-react';

import { auth, db } from './firebase';
import './App.css';

// ==========================================
// 관리자 계정 정보 설정
// ==========================================
const ALLOWED_ADMINS = ['judam1', 'judam2', 'judam3'];
const DOMAIN_SUFFIX = '@father-app.com'; // 아이디를 이메일 형식으로 자동 전환하기 위한 도메인

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
  onToggleLike: (postId: string, currentLikes: string[]) => void;
  onAddComment: (postId: string, commentText: string) => void;
  onSelectTag: (tag: string) => void;
}

// ==========================================
// Main Component
// ==========================================
export default function App() {
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

  // Auth Listener (익명 로그인 사용 안함)
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

      // 최신순 정렬
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
      // 기존 계정 로그인 시도
      await signInWithEmailAndPassword(auth, email, loginPassword);
      setShowLoginForm(false);
      setLoginInputId('');
      setLoginPassword('');
    } catch (err: any) {
      // 계정이 없으면 자동 회원가입 후 로그인
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

  // Submit Post (관리자만 실행 가능)
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
      userId: user ? user.uid : 'visitor',
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
        <h1 className="app-title">공감과 기록</h1>
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

        {/* Search Bar */}
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="태그나 키워드로 검색해보세요..."
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Editor Card (관리자로 로그인한 경우에만 작성 가능) */}
        {adminId ? (
          <section className="editor-card">
            <input
              type="text"
              placeholder="오늘 하루의 제목 (선택)"
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              className="editor-title"
            />

            <textarea
              rows={4}
              placeholder="오늘 어떤 마음으로 하루를 보내셨나요? 편안하게 기록해보세요..."
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
                placeholder="태그 입력 후 Enter (#일상)"
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
                  <span>기분:</span>
                  {['평온', '기쁨', '우울'].map((m) => (
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
                  title="손그림 그리기"
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
            글 작성 권한은 지정된 관리자만 사용할 수 있습니다.
          </div>
        )}

        {/* Post List */}
        <section className="post-list">
          {filteredPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9E8E81', fontSize: '0.875rem' }}>
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 이야기 가 없습니다.'}
            </div>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user ? user.uid : 'anonymous_visitor'}
                onToggleLike={handleToggleLike}
                onAddComment={handleAddComment}
                onSelectTag={(t) => setSearchQuery(t)}
              />
            ))
          )}
        </section>
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
function PostCard({ post, currentUserId, onToggleLike, onAddComment, onSelectTag }: PostCardProps) {
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
        <div>
          {post.createdAt ? new Date(post.createdAt.toMillis()).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
          }) : '방금 전'}
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
                    <span>{comment.createdAt}</span>
                  </div>
                  <p className="comment-text">{comment.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCommentSubmit} className="comment-form">
            <input
              type="text"
              placeholder="댓글을 남겨보세요..."
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