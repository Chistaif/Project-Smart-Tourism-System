document.addEventListener("DOMContentLoaded", function () {

    // POPUP UTILS --------------------------------------------------------
    function openPopup(popup, overlay) {
        popup.classList.add("active");
        popup.style.display = "block";
        overlay.style.display = "block";
    }

    function closePopup(popup, overlay) {
        popup.classList.remove("active");
        popup.style.display = "none";
        overlay.style.display = "none";
    }

    // DOM ELEMENTS -------------------------------------------------------
    const loginPopup = document.getElementById("login-popup");
    const loginOverlay = document.getElementById("login-overlay");

    const signupPopup = document.getElementById("signup-popup");
    const signupOverlay = document.getElementById("signup-overlay");

    const signup2Popup = document.getElementById("signup2-popup");
    const signup2Overlay = document.getElementById("signup2-overlay");

    const forgotPopup = document.getElementById("forgot-popup");
    const forgotOverlay = document.getElementById("forgot-overlay");

    const forgot2Popup = document.getElementById("forgot2-popup");
    const forgot2Overlay = document.getElementById("forgot2-overlay");

    const forgot3Popup = document.getElementById("forgot3-popup");
    const forgot3Overlay = document.getElementById("forgot3-overlay");

    // LOGIN ---------------------------------------------------------------
    const loginBtns = document.querySelectorAll(".login-btn");

    loginBtns.forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            openPopup(loginPopup, loginOverlay);
        });
    });

    loginOverlay.addEventListener("click", () => closePopup(loginPopup, loginOverlay));


    // SIGNUP STEP 1 -------------------------------------------------------
    const signupButtons = document.querySelectorAll(".signup-btn, #login-popup .login-link");

    signupButtons.forEach(btn => {
        btn.addEventListener("click", function (e) {
            if (btn.textContent.includes("Tạo tài khoản") || btn.classList.contains("signup-btn")) {
                e.preventDefault();
                closePopup(loginPopup, loginOverlay);
                openPopup(signupPopup, signupOverlay);
            }
        });
    });

    signupOverlay.addEventListener("click", () => closePopup(signupPopup, signupOverlay));

    document.querySelector(".back-to-login").addEventListener("click", function (e) {
        e.preventDefault();
        closePopup(signupPopup, signupOverlay);
        openPopup(loginPopup, loginOverlay);
    });


    // SIGNUP STEP 2 -------------------------------------------------------
    document.querySelector("#signup-popup .login-btn-submit").addEventListener("click", function (e) {
        e.preventDefault();
        closePopup(signupPopup, signupOverlay);
        openPopup(signup2Popup, signup2Overlay);
    });

    signup2Overlay.addEventListener("click", () => closePopup(signup2Popup, signup2Overlay));

    document.querySelector(".back-to-signup1").addEventListener("click", function (e) {
        e.preventDefault();
        closePopup(signup2Popup, signup2Overlay);
        openPopup(loginPopup, loginOverlay);
    });


    // FORGOT STEP 1 -------------------------------------------------------
    const forgotLink = document.querySelector("#login-popup .login-footer-links .login-link");

    forgotLink.addEventListener("click", function (e) {
        if (forgotLink.textContent.includes("Quên mật khẩu")) {
            e.preventDefault();
            closePopup(loginPopup, loginOverlay);
            openPopup(forgotPopup, forgotOverlay);
        }
    });

    forgotOverlay.addEventListener("click", () => closePopup(forgotPopup, forgotOverlay));

    document.querySelector(".back-to-login-from-forgot").addEventListener("click", function (e) {
        e.preventDefault();
        closePopup(forgotPopup, forgotOverlay);
        openPopup(loginPopup, loginOverlay);
    });


    // FORGOT STEP 2 -------------------------------------------------------
    const otpInputs = document.querySelectorAll(".otp-input");

    otpInputs.forEach((box, index) => {
        box.addEventListener("input", () => {
            if (box.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
    });

    document.querySelector("#forgot-popup .login-btn-submit").addEventListener("click", function(e){
        e.preventDefault();
        closePopup(forgotPopup, forgotOverlay);
        openPopup(forgot2Popup, forgot2Overlay);
        otpInputs[0].focus();
    });

    forgot2Overlay.addEventListener("click", () => closePopup(forgot2Popup, forgot2Overlay));

    document.querySelector(".back-to-forgot1").addEventListener("click", function (e) {
        e.preventDefault();
        closePopup(forgot2Popup, forgot2Overlay);
        openPopup(forgotPopup, forgotOverlay);
    });


    // FORGOT STEP 3 -------------------------------------------------------
    document.querySelector("#forgot2-popup .login-btn-submit").addEventListener("click", function(e){
        e.preventDefault();
        closePopup(forgot2Popup, forgot2Overlay);
        openPopup(forgot3Popup, forgot3Overlay);
    });

    forgot3Overlay.addEventListener("click", () => closePopup(forgot3Popup, forgot3Overlay));

    document.querySelector(".back-to-forgot2").addEventListener("click", function (e) {
        e.preventDefault();
        closePopup(forgot3Popup, forgot3Overlay);
        openPopup(forgot2Popup, forgot2Overlay);
    });


    // GUEST MODE ----------------------------------------------------------
    const guestLinks = document.querySelectorAll(".guest-continue");

    guestLinks.forEach(link => {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            [
                [loginPopup, loginOverlay],
                [signupPopup, signupOverlay],
                [signup2Popup, signup2Overlay],
                [forgotPopup, forgotOverlay],
                [forgot2Popup, forgot2Overlay],
                [forgot3Popup, forgot3Overlay]
            ].forEach(item => closePopup(item[0], item[1]));
        });
    });

});
