import { Link } from 'react-router-dom'
import './KVKK.css'

export default function KVKK() {
  return (
    <div className="kvkk-page">
      <header className="kvkk-header">
        <Link to="/" className="kvkk-header-logo">
          <img src="/LOGO.png" alt="Kunye.tech" />
          <span>Kunye.tech</span>
        </Link>
        <Link to="/" className="kvkk-back">← Ana Sayfa</Link>
      </header>

      <main className="kvkk-main">
        <h1>Kişisel Verilerin Korunması ve İşlenmesine İlişkin Aydınlatma Metni</h1>

        <div className="kvkk-veri-sorumlusu">
          <p><strong>Veri Sorumlusu:</strong> Künye Yazılım Bilişim Ltd. Şti.</p>
          <p><strong>Adres:</strong> Teknopark, İvedik OSB, 2224. Cd. No:1 B Blok Zemin Kat, 06378 Yenimahalle/Ankara</p>
          <p><strong>E-posta:</strong> <a href="mailto:info@kunye.tech">info@kunye.tech</a></p>
          <p><strong>İnternet Sitesi:</strong> <a href="https://www.kunye.tech" target="_blank" rel="noopener noreferrer">https://www.kunye.tech</a></p>
        </div>

        <section className="kvkk-section">
          <h2>1. Amaç</h2>
          <p>
            İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun ("Kanun") 10. maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, Künye Yazılım Bilişim Ltd. Şti. ("Şirket" veya "Künye") tarafından veri sorumlusu sıfatıyla işlenen kişisel verilerinize ilişkin sizleri bilgilendirmek amacıyla hazırlanmıştır.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>2. İşlenen Kişisel Veriler ve İşlenme Amaçları</h2>

          <h3>2.1 Platform Kullanıcıları (Müşteri Firmalar ve Yetkilileri)</h3>
          <div className="kvkk-table-wrapper">
            <table className="kvkk-table">
              <thead>
                <tr>
                  <th>Kişisel Veri Kategorisi</th>
                  <th>İşlenen Veriler</th>
                  <th>İşlenme Amacı</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Kimlik Bilgileri</td>
                  <td>Ad, soyad, unvan</td>
                  <td>Kullanıcı hesabı oluşturma, sözleşme ilişkisinin kurulması</td>
                </tr>
                <tr>
                  <td>İletişim Bilgileri</td>
                  <td>E-posta adresi, telefon numarası, iş adresi</td>
                  <td>Platform erişimi sağlama, bildirim gönderme, iletişim</td>
                </tr>
                <tr>
                  <td>Şirket Bilgileri</td>
                  <td>Şirket unvanı, vergi numarası, faaliyet alanı</td>
                  <td>Abonelik yönetimi, faturalama</td>
                </tr>
                <tr>
                  <td>İşlem Güvenliği</td>
                  <td>IP adresi, oturum bilgileri, erişim logları, tarayıcı bilgileri</td>
                  <td>Platform güvenliğinin sağlanması, yetkisiz erişimin önlenmesi</td>
                </tr>
                <tr>
                  <td>Platform Kullanım Verileri</td>
                  <td>Giriş/çıkış zamanları, kullanılan özellikler, işlem kayıtları</td>
                  <td>Hizmetin iyileştirilmesi, teknik destek, denetim izi (audit trail)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>2.2 Tedarikçi Portal Kullanıcıları</h3>
          <div className="kvkk-table-wrapper">
            <table className="kvkk-table">
              <thead>
                <tr>
                  <th>Kişisel Veri Kategorisi</th>
                  <th>İşlenen Veriler</th>
                  <th>İşlenme Amacı</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Kimlik Bilgileri</td>
                  <td>Ad, soyad, unvan</td>
                  <td>Tedarikçi hesabı oluşturma</td>
                </tr>
                <tr>
                  <td>İletişim Bilgileri</td>
                  <td>E-posta adresi, telefon numarası</td>
                  <td>Teklif bildirimi, iletişim</td>
                </tr>
                <tr>
                  <td>Şirket Bilgileri</td>
                  <td>Şirket unvanı, vergi numarası, kapasite bilgileri</td>
                  <td>Tedarikçi profili yönetimi</td>
                </tr>
                <tr>
                  <td>İşlem Güvenliği</td>
                  <td>IP adresi, oturum bilgileri</td>
                  <td>Güvenlik, yetkisiz erişimin önlenmesi</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>2.3 İnternet Sitesi Ziyaretçileri</h3>
          <div className="kvkk-table-wrapper">
            <table className="kvkk-table">
              <thead>
                <tr>
                  <th>Kişisel Veri Kategorisi</th>
                  <th>İşlenen Veriler</th>
                  <th>İşlenme Amacı</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>İletişim Bilgileri</td>
                  <td>İletişim formu aracılığıyla paylaşılan ad, e-posta, mesaj içeriği</td>
                  <td>Talep ve sorulara yanıt verilmesi</td>
                </tr>
                <tr>
                  <td>İşlem Güvenliği</td>
                  <td>IP adresi, çerez verileri</td>
                  <td>İnternet sitesinin işleyişi ve güvenliği</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="kvkk-section">
          <h2>3. Kişisel Verilerin İşlenme Hukuki Sebepleri</h2>
          <p>Kişisel verileriniz, Kanun'un 5. maddesinde belirtilen aşağıdaki hukuki sebepler çerçevesinde işlenmektedir:</p>
          <ul className="kvkk-list">
            <li><strong>Sözleşmenin kurulması veya ifası (md. 5/2-c):</strong> Platform aboneliğinin sağlanması, kullanıcı hesabının oluşturulması ve hizmetin sunulması.</li>
            <li><strong>Hukuki yükümlülüğün yerine getirilmesi (md. 5/2-ç):</strong> Vergi mevzuatı, 6102 sayılı Türk Ticaret Kanunu ve ilgili düzenlemeler kapsamındaki yükümlülükler.</li>
            <li><strong>Meşru menfaat (md. 5/2-f):</strong> Platformun güvenliğinin sağlanması, hizmet kalitesinin artırılması, denetim izi oluşturulması.</li>
            <li><strong>Açık rıza (md. 5/1):</strong> Pazarlama amaçlı iletişim, yurt dışına veri aktarımı gibi hallerde (ayrıca alınır).</li>
          </ul>
        </section>

        <section className="kvkk-section">
          <h2>4. Kişisel Verilerin Toplanma Yöntemi</h2>
          <p>Kişisel verileriniz aşağıdaki yöntemlerle toplanmaktadır:</p>
          <ul className="kvkk-list">
            <li>kunye.tech platformuna kayıt olmanız sırasında elektronik ortamda,</li>
            <li>Tedarikçi portalı üzerinden hesap oluşturmanız sırasında elektronik ortamda,</li>
            <li>İnternet sitemizi ziyaretiniz sırasında çerezler aracılığıyla otomatik yollarla,</li>
            <li>İletişim formu, e-posta veya telefon yoluyla tarafımıza ilettiğiniz bilgiler aracılığıyla.</li>
          </ul>
        </section>

        <section className="kvkk-section">
          <h2>5. Kişisel Verilerin Aktarılması</h2>
          <p>Kişisel verileriniz, Kanun'un 8. ve 9. maddelerinde belirtilen koşullar çerçevesinde aşağıdaki alıcı gruplarına aktarılabilecektir:</p>
          <div className="kvkk-table-wrapper">
            <table className="kvkk-table">
              <thead>
                <tr>
                  <th>Alıcı Grubu</th>
                  <th>Aktarım Amacı</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bulut hizmet sağlayıcıları</td>
                  <td>Platformun barındırılması ve teknik altyapının sağlanması</td>
                </tr>
                <tr>
                  <td>İş ortakları (ERP, e-Fatura entegrasyonları)</td>
                  <td>Entegrasyon hizmetlerinin sunulması</td>
                </tr>
                <tr>
                  <td>Hukuk ve mali müşavirlik hizmeti sağlayıcıları</td>
                  <td>Yasal yükümlülüklerin yerine getirilmesi</td>
                </tr>
                <tr>
                  <td>Yetkili kamu kurum ve kuruluşları</td>
                  <td>Mevzuat gereği bilgi/belge paylaşılması</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="kvkk-note">
            <strong>Yurt dışı aktarım:</strong> Platformun teknik altyapısında kullanılan bulut hizmet sağlayıcılarının sunucuları yurt dışında bulunabilmektedir. Bu durumda yurt dışına veri aktarımı, Kanun'un 9. maddesi kapsamında gerekli güvenceler sağlanarak ve/veya açık rızanız alınarak gerçekleştirilecektir.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>6. Kişisel Verilerin Saklanma Süresi</h2>
          <p>
            Kişisel verileriniz, işlenme amaçlarının gerektirdiği süre boyunca ve her halükârda yasal saklama yükümlülüklerinin öngördüğü süre boyunca saklanacaktır. İlgili sürenin sona ermesinin ardından kişisel verileriniz silinecek, yok edilecek veya anonim hale getirilecektir.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>7. İlgili Kişi Olarak Haklarınız</h2>
          <p>Kanun'un 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
          <ul className="kvkk-list">
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
            <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,</li>
            <li>Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
            <li>Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,</li>
            <li>Kişisel verilerinizin eksik veya yanlış işlenmiş olması halinde bunların düzeltilmesini isteme,</li>
            <li>Kanun'un 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme,</li>
            <li>Yukarıdaki düzeltme ve silme işlemlerinin kişisel verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
            <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,</li>
            <li>Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme.</li>
          </ul>
        </section>

        <section className="kvkk-section">
          <h2>8. Başvuru Yöntemi</h2>
          <p>Yukarıda belirtilen haklarınızı kullanmak için talebinizi aşağıdaki yöntemlerle iletebilirsiniz:</p>
          <ul className="kvkk-list">
            <li><strong>E-posta:</strong> <a href="mailto:info@kunye.tech">info@kunye.tech</a> adresine kimliğinizi tevsik edici belgelerle birlikte</li>
            <li><strong>Yazılı başvuru:</strong> Teknopark, İvedik OSB, 2224. Cd. No:1 B Blok Zemin Kat, 06378 Yenimahalle/Ankara adresine iadeli taahhütlü posta veya noter aracılığıyla</li>
          </ul>
          <p>
            Başvurularınız en geç 30 (otuz) gün içinde ücretsiz olarak sonuçlandırılacaktır. İşlemin ayrıca bir maliyet gerektirmesi halinde, Kişisel Verileri Koruma Kurulu tarafından belirlenen tarifedeki ücret alınabilecektir.
          </p>
        </section>

        <section className="kvkk-section">
          <h2>9. Aydınlatma Metninin Güncellenmesi</h2>
          <p>
            İşbu Aydınlatma Metni, mevzuat değişiklikleri ve Şirket uygulamalarındaki gelişmelere paralel olarak güncellenebilecektir. Güncellemeler internet sitemizde yayımlanarak yürürlüğe girecektir.
          </p>
        </section>

        <p className="kvkk-date">Son Güncelleme Tarihi: Mart 2026</p>
      </main>

      <footer className="kvkk-footer">
        <Link to="/">Ana Sayfaya Dön</Link>
        <span className="kvkk-footer-copy">&copy; 2026 Kunye.tech</span>
      </footer>
    </div>
  )
}
