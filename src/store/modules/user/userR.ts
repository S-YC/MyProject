import {
  AsyncThunk,
  createAsyncThunk,
  createSlice,
  PayloadAction,
} from "@reduxjs/toolkit";
import { AxiosResponse } from "axios";
import { RootState } from "..";
import { config } from "../../../config/config";

import Http, { IRes } from "../../net/Http";
import { decrypt } from "../../net/Security";

// 이름 설정
const name = "user";
/**
 * 저장될 유저 정보 인터페이스 설정
 */
export interface IUser {
  reqId: string;
  id?: string;
  uname?: string;
}
/**
 * 서버와 통신할때 필요한 정보
 */
export interface IUserFetc {
  email: string;
  pwd: string;
}

export interface IResLogin {
  token: string;
  key: string;
}

/**
 * CSR 에서 로그인을 위한 서버통신 액션 함수
 * 비동기 함수를 생성 pending, fulfilled, rejected 를 실행되게
 */
export const fetchLogin: AsyncThunk<
  IRes<IResLogin>,
  IUserFetc,
  { state: RootState }
> = createAsyncThunk<IRes<IResLogin>, IUserFetc, { state: RootState }>(
  `${name}/fetchLogin`,
  async (params: IUserFetc, thunkApi) => {
    try {
      return login(params);
    } catch (err) {
      // 통신 실패 처리
      return thunkApi.rejectWithValue(err);
    }
  },
  {
    // TODO: 값을 알수없음 무었이 넘어오는지 확인이 필요함
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    condition: (params: IUserFetc, thunkApi) => {
      // 통신 중단 조건 처리
      if (params.email === "" || params.pwd === "") {
        return false;
      }
    },
    // condition 에서 return 값이 false 이면 rejected 가 실행되게 처리
    dispatchConditionRejection: true,
  }
);
/**
 * SSR 일때 통신하기 위한 함수
 * @param params IUserFetc
 * @returns
 */
export const login: (param: IUserFetc) => Promise<IRes<IResLogin>> = async (
  params: IUserFetc
): Promise<IRes<IResLogin>> => {
  const res: AxiosResponse<IRes<IResLogin>> = await Http.post(
    "/user/login",
    params
  );
  return res.data;
};
/**
 * CSR 에서 로그아웃 처리를 위한 액션 함수
 */
export const fetchLogout: AsyncThunk<
  IRes<string>,
  void,
  { state: RootState }
> = createAsyncThunk<IRes<string>>(
  `${name}/fetchLogout`,
  async (_, thunkApi) => {
    try {
      return logout();
    } catch (err) {
      return thunkApi.rejectWithValue(err);
    }
  }
);
/**
 * SSR 일때 통신하기 위한 함수
 * @returns
 */
export const logout: () => Promise<IRes<string>> = async (): Promise<
  IRes<string>
> => {
  const res: AxiosResponse<IRes<string>> = await Http.post("/user/logout");
  return res.data;
};

// data 를 관리하는 reducer 설정
const userSlice = createSlice({
  name,
  initialState: { reqId: "", id: "" } as IUser,
  reducers: {
    loginAction(state: IUser, action: PayloadAction<IUser>) {
      return { ...state, ...action.payload };
    },
    logoutAction() {
      return { reqId: "", id: "" };
    },
  },
  extraReducers: builder => {
    // pending 액션을 통해 상태를 변화 시키기 위한 등록
    // 서버 통신하기전 호출되는 함수
    builder.addCase(fetchLogin.pending, (state: IUser, action) => {
      return { ...state, reqId: action.meta.requestId };
    });
    // fulfilled 액션을 통해 상태를 변화 시키기 위한 등록
    // 서버 통신후 성공 하면 호출되는 함수
    builder.addCase(fetchLogin.fulfilled, (state: IUser, { payload }) => {
      if (payload.result) {
        const expires = new Date();
        expires.setDate(Date.now() + 1000 * 60 * 60 * 24);
        // localStorage.setItem("token", payload.data);
        const loginpayload: IResLogin = payload.data as IResLogin;
        sessionStorage.setItem(config.token.name, loginpayload.token);
        sessionStorage.setItem("key", decrypt(loginpayload.key));
        Http.defaults.headers[config.token.header] = sessionStorage.getItem(
          config.token.name
        );
        // Http.defaults.headers["localStorage"] = localStorage.getItem("token");
      } else {
        console.log(payload.data);
      }
    });
    // rejected 액션을 통해 상태를 변화 시키기 위한 등록
    // 서버 통신이 실패 했을때 호출되는 함수
    builder.addCase(fetchLogin.rejected, (state: IUser, action) => {
      console.log("실패", state, action);
    });
    /** logout */
    builder.addCase(fetchLogout.pending, (state: IUser, action) => {
      return { ...state, reqId: action.meta.requestId };
    });
    builder.addCase(fetchLogout.fulfilled, (state: IUser, { payload }) => {
      if (payload.result) {
        localStorage.removeItem(config.token.name);
        sessionStorage.removeItem(config.token.name);
        delete Http.defaults.headers[config.token.header];
        // delete Http.defaults.headers["localStorage"];
        // delete Http.defaults.headers["cookies"];
      }
    });
    builder.addCase(fetchLogout.rejected, (state: IUser, action) => {
      console.log("실패", state, action);
    });
  },
});

/**
 * CSR 에서 쓰는 액션들
 */
export const { loginAction, logoutAction } = userSlice.actions;
// data 를 관리하는 reducer 기본 반환 설정
export default userSlice.reducer;
