import { Link } from 'react-router-dom'
import './KVKK.css'

export default function KVKK() {
  return (
    <div className="kvkk-page">
      <header className="kvkk-header">
        <Link to="/" className="kvkk-header-logo">
          <img src="/logo.png" alt="Kunye.tech" />
          <span>Kunye.tech</span>
        </Link>
        <Link to="/" className="kvkk-back">← Ana Sayfa</Link>
      </header>

      <main className="kvkk-main">
        <h1>KVKK Aydınlatma Metni</h1>
        <p className="kvkk-intro">
          6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında, kişisel verileriniz veri sorumlusu sıfatıyla Kunye.tech tarafından aşağıda açıklanan çerçevede işlenmektedir.
        </p>

        <section className="kvkk-section">
          <h2>1. Veri Sorumlusu</h2>
          <p>
            Kişisel verileriniz, 6698 sayılı Kanun uyarınca veri sorumlusu olan Kunye.tech (adres ve iletişim bilgileriniz [şirket bilgilerinizi buraya ekleyebilirsiniz]) tarafından aşağıda açıklanan kapsamda işlenebilecektir.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>2. İşlenen Kişisel Veriler ve İşleme Amaçları</h2>
          <p>
            Kimlik (ad, soyadı), iletişim (e-posta, telefon), müşteri işlem bilgileri ve platform kullanım verileriniz; hizmet sunumu, sözleşme süreçleri, iletişim, talep ve şikayet yönetimi, yasal yükümlülüklerin yerine getirilmesi ve meşru menfaat kapsamında işlenmektedir.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>3. Kişisel Verilerin İşlenmesinin Hukuki Sebepleri</h2>
          <p>
            Kişisel verileriniz; açık rızanız, sözleşmenin ifası, hukuki yükümlülük ve veri sorumlusunun meşru menfaatleri gibi KVKK’da sayılan hukuki sebeplere dayanılarak işlenmektedir.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>4. Saklama Süresi</h2>
          <p>
            Kişisel verileriniz, işleme amacının gerektirdiği süre ve yasal saklama süreleri boyunca saklanacak; bu sürelerin sonunda silinecek, yok edilecek veya anonim hale getirilecektir.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>5. Haklarınız</h2>
          <p>
            KVKK’nın 11. maddesi uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, Kanun’un 7. maddesinde öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme, otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.
          </p>
          <p>
            Başvurularınızı, veri sorumlusuna yazılı olarak veya Kişisel Verileri Koruma Kurulu’nun belirlediği diğer yöntemlerle iletebilirsiniz.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>6. İletişim</h2>
          <p>
            KVKK kapsamındaki talepleriniz için web sitemizdeki İletişim bölümünden veya yasal olarak bildireceğimiz diğer kanallardan bize ulaşabilirsiniz.
          </p>
        </section>

        <p className="kvkk-date">Son güncelleme: Şubat 2026</p>
      </main>

      <footer className="kvkk-footer">
        <Link to="/">Ana Sayfaya Dön</Link>
        <span className="kvkk-footer-copy">&copy; 2026 Kunye.tech</span>
      </footer>
    </div>
  )
}
